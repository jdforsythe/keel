/** Submitted FormData as plain values (a repeated key gives an array; a file gives its name). */
export function valuesOf(form: FormData): Readonly<Record<string, string | readonly string[]>> {
  const out: Record<string, string | readonly string[]> = {};
  for (const key of new Set(form.keys())) {
    const all = form.getAll(key).map((v) => (typeof v === "string" ? v : v.name));
    out[key] = all.length === 1 ? (all[0] ?? "") : all;
  }
  return out;
}
