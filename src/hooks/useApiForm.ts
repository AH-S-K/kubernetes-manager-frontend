/**
 * useForm + zodResolver + backend-validation wiring in one hook.
 *
 * handleApiSubmit(onValid) wraps RHF's handleSubmit so that:
 *   - schema failures        → inline (resolver, standard RHF)
 *   - VALIDATION_ERROR       → inline (applyApiErrors → field/root setError)
 *   - everything else        → already toasted by the global bus; swallowed
 *                              here to avoid an unhandled rejection in the
 *                              DOM event handler.
 * The dialog stays open in every failure case — closing is the caller's job
 * after mutateAsync resolves.
 *
 * TOutput: parsed output type. Set it explicitly when the schema transforms
 * inputs (e.g. appFormSchema coerces replicas "3" → 3):
 *   useApiForm<AppFormInput, AppFormValues>({ schema: appFormSchema })
 * This works because RHF passes the *resolver's* returned (parsed) values to
 * the submit handler at runtime — the cast below only fixes old typings.
 */
import { useCallback } from "react";
import {
  useForm,
  type FieldValues,
  type SubmitHandler,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, type ZodType } from "zod";
import { applyApiErrors } from "@/lib/forms/apiErrors";
import { ApiError } from "@/lib/api/client";

type HandleApiSubmit<TOutput extends FieldValues> = (
  onValid: SubmitHandler<TOutput>,
) => (e?: any) => Promise<void>;

export type ApiForm<TFieldValues extends FieldValues, TOutput extends FieldValues> =
  UseFormReturn<TFieldValues> & {
    handleApiSubmit: HandleApiSubmit<TOutput>;
  };

export function useApiForm<
  TFieldValues extends FieldValues,
  TOutput extends FieldValues = TFieldValues,
>(
  props: Omit<UseFormProps<TFieldValues>, "resolver"> & {
    schema: ZodType<TOutput, z.ZodTypeDef, TFieldValues>;
  },
): ApiForm<TFieldValues, TOutput> {
  const { schema, ...formProps } = props;

  // Fields eligible for inline server errors = the schema's own keys.
  const fieldNames =
    schema instanceof z.ZodObject ? Object.keys(schema.shape) : undefined;

  const form = useForm<TFieldValues>({
    ...formProps,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
  });

  const handleApiSubmit = useCallback<HandleApiSubmit<TOutput>>(
    (onValid) =>
      (form.handleSubmit as unknown as (
        onValid: SubmitHandler<TOutput>,
      ) => (e?: any) => Promise<void>)(
        async (values, event) => {
          try {
            await onValid(values, event);
          } catch (error) {
            const isFieldMapped = applyApiErrors(error, form.setError, { fields: fieldNames });
            if (!isFieldMapped) {
              const apiError = ApiError.from(error);
              form.setError("root", { type: "server", message: apiError.userMessage });
            }
          }
        },
      ),
    [form, fieldNames],
  );

  return { ...form, handleApiSubmit };
}