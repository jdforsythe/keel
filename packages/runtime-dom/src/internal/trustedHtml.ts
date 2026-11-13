let policy: { readonly from: unknown; readonly made: unknown } | undefined;

/**
 * `html` as the policy `keel` makes it where `globalThis.trustedTypes` exists, created once (k.security Trusted
 * Types); otherwise `html` itself. The policy passes compiler output through unchanged.
 */
export function trustedHtml(html: string): unknown {
  const tt: unknown = Reflect.get(globalThis, "trustedTypes");
  const create: unknown = typeof tt === "object" && tt !== null ? Reflect.get(tt, "createPolicy") : undefined;
  if (typeof tt !== "object" || tt === null || typeof create !== "function") return html;
  if (policy?.from !== tt) {
    const made: unknown = Reflect.apply(create, tt, ["keel", { createHTML: (s: string) => s }]);
    policy = { from: tt, made };
  }
  const make: unknown =
    typeof policy.made === "object" && policy.made !== null ? Reflect.get(policy.made, "createHTML") : undefined;
  return typeof make === "function" ? Reflect.apply(make, policy.made, [html]) : html;
}
