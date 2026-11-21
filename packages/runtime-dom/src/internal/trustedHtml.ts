/** The realm-wide slot every runtime-dom copy shares: `{ from: trustedTypes, made: policy }`. */
const SLOT = Symbol.for("keel.trustedTypes");

/** The policy `keel` this realm already made for `tt`, if any. */
function shared(tt: object): unknown {
  const slot: unknown = Reflect.get(globalThis, SLOT);
  return typeof slot === "object" && slot !== null && Reflect.get(slot, "from") === tt
    ? Reflect.get(slot, "made")
    : undefined;
}

/**
 * `html` as the policy `keel` makes it where `globalThis.trustedTypes` exists, created once per realm and shared by
 * every runtime copy on the page (k.security Trusted Types); otherwise `html` itself. The policy passes compiler
 * output through unchanged. When the policy cannot be created (another script took the name, or the page's
 * `trusted-types` directive does not list `keel`), it throws an Error saying so rather than hand an HTML sink a
 * plain string the browser would refuse.
 */
export function trustedHtml(html: string): unknown {
  const tt: unknown = Reflect.get(globalThis, "trustedTypes");
  const create: unknown = typeof tt === "object" && tt !== null ? Reflect.get(tt, "createPolicy") : undefined;
  if (typeof tt !== "object" || tt === null || typeof create !== "function") return html;
  let made = shared(tt);
  if (made === undefined) {
    try {
      made = Reflect.apply(create, tt, ["keel", { createHTML: (s: string) => s }]);
    } catch (cause) {
      throw new Error("k.security: the Trusted Types policy keel could not be created", { cause });
    }
    Reflect.set(globalThis, SLOT, { from: tt, made });
  }
  const make: unknown = typeof made === "object" && made !== null ? Reflect.get(made, "createHTML") : undefined;
  return typeof make === "function" ? Reflect.apply(make, made, [html]) : html;
}
