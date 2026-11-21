/** E1606 (k.persist): a `commit` naming one key twice. The message names no key: a key is app data. */
export function E1606(): Error {
  return Object.assign(new Error("commit names one key twice"), { code: "E1606" });
}
