/** The relative specifier from `fromFile` to `toFile` (`./x.ts`, `../m/x.ts`). */
export function relSpec(fromFile: string, toFile: string): string {
  const f = fromFile.split("/").slice(0, -1);
  const t = toFile.split("/");
  let i = 0;
  while (i < f.length && i < t.length - 1 && f[i] === t[i]) i++;
  const r = [...f.slice(i).map(() => ".."), ...t.slice(i)].join("/");
  return r.startsWith("../") ? r : `./${r}`;
}
