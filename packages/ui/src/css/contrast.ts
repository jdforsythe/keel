const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const luminance = (hex: string): number => {
  if (!HEX.test(hex)) throw new RangeError(`contrast needs #rgb or #rrggbb, got ${JSON.stringify(hex).slice(0, 40)}`);
  const h = hex.length === 4 ? hex.replace(/[0-9a-fA-F]/g, "$&$&") : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};

/**
 * WCAG 2 contrast ratio of two `#rgb`/`#rrggbb` colors, 1..21, symmetric. E1804 requires >= 4.5
 * (>= 3 at fontSize >= 24px). Throws RangeError for any other color syntax.
 */
export function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
