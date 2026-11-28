/** `Date.prototype.toISOString` of `ms` in UTC, or `""` when `ms` is not a valid time value. Host-independent. */
export function iso(ms: number): string {
  const t = new Date(ms);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString();
}
