import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * Sonner <Toaster/> slaved to next-themes so toasts always match the app theme.
 * Pre-mount resolvedTheme is briefly undefined → falls back to "dark", which
 * matches defaultTheme and the index.html bootstrap.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === "light" ? "light" : "dark"}
      closeButton
      richColors
      expand
      duration={4_000}
    />
  );
}