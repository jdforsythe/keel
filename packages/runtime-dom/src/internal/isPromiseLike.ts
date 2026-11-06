/** True for any thenable. */
export function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
  return (
    (typeof x === "object" || typeof x === "function") && x !== null && "then" in x && typeof x.then === "function"
  );
}
