/** A length token in px: `px` as is, `rem` and `em` at 16px; anything else is NaN. */
export function px(v: string): number {
  const m = /^(-?[\d.]+)(px|rem|em)$/.exec(v.trim());
  return m === null ? Number.NaN : Number(m[1]) * (m[2] === "px" ? 1 : 16);
}
