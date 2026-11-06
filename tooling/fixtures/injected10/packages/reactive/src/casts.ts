declare const x: unknown;
declare const m: { a?: { b: number } };
export function casts(): number {
  const a = x as number;
  const b: any = 1;
  const c = m.a!.b;
  // @ts-ignore
  const d: number = "nope";
  // @ts-expect-error
  const e: number = "nope";
  return a + b + c + d + e;
}
