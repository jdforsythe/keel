/**
 * The members one host view of a build-time evaluation lists (k.compiler Build-time evaluation): `pure`, given as they
 * are (no host state); `call`, each call recorded with its arguments as a probe and answered again; `fact`, each read
 * recorded as a probe (a function among them called with no arguments only); `view`, each member the bundle's own view
 * of a named kind (`OBSERVE_BANNER`). A member on none of them is refused (E1050): a function at its call or
 * construction, any other value at its read.
 */
export type HostMembers = {
  readonly pure?: readonly string[];
  readonly call?: readonly string[];
  readonly fact?: readonly string[];
  readonly view?: Readonly<Record<string, string>>;
};
