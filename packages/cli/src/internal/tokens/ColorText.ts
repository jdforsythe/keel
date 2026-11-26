/** A DTCG color as a k.values form; `space` names the space it was converted from to Oklch; `alpha` is set when the color is not opaque. */
export type ColorText = { readonly text: string; readonly space?: string; readonly alpha?: true };
