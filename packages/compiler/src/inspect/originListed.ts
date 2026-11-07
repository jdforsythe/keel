/** Whether `origin` is in `list`; an entry ending in `:*` matches its scheme and host on any port (RFC 0022). */
export function originListed(list: readonly string[], origin: string): boolean {
  return list.some((o) => {
    if (!o.endsWith(":*")) return o === origin;
    const base = o.slice(0, -2);
    return origin === base || (origin.startsWith(`${base}:`) && /^\d{1,5}$/.test(origin.slice(base.length + 1)));
  });
}
