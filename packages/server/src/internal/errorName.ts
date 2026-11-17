/**
 * The name a log may give a thrown value: an `Error`'s `name` when it is a plain identifier of at most 64 characters,
 * else `Error`. Every read runs inside a try, and the message is never read, so the name holds no request value. Never
 * throws.
 */
export function errorName(thrown: unknown): string {
  try {
    const name: unknown = thrown instanceof Error ? thrown.name : undefined;
    return typeof name === "string" && /^[A-Za-z_$][\w$]{0,63}$/.test(name) ? name : "Error";
  } catch {
    return "Error";
  }
}
