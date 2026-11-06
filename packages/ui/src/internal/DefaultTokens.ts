type Pair = { readonly light: string; readonly dark: string };

/** Token names of the k.ui example `tokens.ts`; used when the app has not augmented `Register`. */
export type DefaultTokens = {
  readonly color: { readonly fg: Pair; readonly bg: Pair; readonly accent: string };
  readonly space: { readonly 0: string; readonly 1: string; readonly 2: string; readonly 3: string };
  readonly radius: { readonly 1: string };
  readonly font: { readonly body: string };
  readonly fontSize: { readonly sm: string; readonly md: string; readonly lg: string };
  readonly breakpoint: { readonly md: string };
  readonly motion: { readonly fast: string };
};
