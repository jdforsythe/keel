/** Run `fn`, which holds a cast; `reason` says why it is sound. */
export function unsafe<T>(reason: string, fn: () => T): T {
  if (reason.length === 0) throw new Error("unsafe requires a justification");
  return fn();
}
