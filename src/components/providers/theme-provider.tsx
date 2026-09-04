import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

/**
 * class-based theming for Tailwind `dark:` variants; dark is the default
 * (DevOps-tool default). index.html bootstraps the class pre-render so the
 * first paint is already correct.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}