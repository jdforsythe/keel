/** Connectivity as the real net reads it: `navigator.onLine`, true without a `navigator`. */
export function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
