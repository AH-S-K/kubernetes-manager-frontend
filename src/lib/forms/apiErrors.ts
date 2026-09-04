/**
 * Maps a backend VALIDATION_ERROR onto React Hook Form.
 *
 * Returns:
 *   true  → every message was surfaced inline (field and/or root); the caller
 *           can swallow the rejection safely.
 *   false → not a validation error; the global bus already toasted it, so the
 *           caller should simply move on (no double reporting).
 *
 * Run-time notes:
 * - DRF puts real per-field messages inside `details` (the envelope's top-level
 *   message is the useless "Request failed.") — the client's flattenFieldErrors
 *   already lifted them into ApiError.fieldErrors, with non_field_errors → "detail".
 * - Keys that match no rendered field fall into the root error so nothing the
 *   backend says is ever silently dropped.
 */
import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api/client";

interface Options {
  /** Rendered form fields eligible for inline mapping. Derived from the Zod
   *  schema shape in useApiForm; anything else lands in the root error. */
  fields?: readonly string[];
}

export function applyApiErrors<TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
  options: Options = {},
): boolean {
  const apiError = ApiError.from(error);
  if (!apiError.isValidation) return false;

  const eligible = new Set(options.fields ?? []);
  const rootMessages: string[] = [];
  let mapped = false;

  for (const [key, messages] of Object.entries(apiError.fieldErrors)) {
    const message = messages.join(" ");

    if (key === "detail") {
      // Form-level (incl. DRF non_field_errors) → root banner.
      rootMessages.push(message);
      mapped = true;
      continue;
    }

    if (eligible.size === 0 || eligible.has(key)) {
      // Safe cast: eligibility was just verified against the schema's fields.
      setError(key as FieldPath<TValues>, {
        type: "server",
        message,
      });
      mapped = true;
    } else {
      rootMessages.push(`${key}: ${message}`);
      mapped = true;
    }
  }

  if (rootMessages.length > 0) {
    setError("root", { type: "server", message: rootMessages.join(" ") });
  }

  if (!mapped) {
    // Envelope carried no per-field details at all — still show the message.
    setError("root", { type: "server", message: apiError.userMessage });
  }

  return true;
}