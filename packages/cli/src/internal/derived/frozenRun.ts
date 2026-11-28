/**
 * Whether a command runs frozen (k.derived Frozen): `--frozen`, `CI` set to a value other than empty, `0` or `false`,
 * or `KEEL_FROZEN=1`. Frozen, no view is written and a view that differs from its derivation is E1005.
 */
export function frozenRun(flag: boolean | undefined, env: Readonly<Record<string, string>> | undefined): boolean {
  const ci = env?.CI;
  return flag === true || (ci !== undefined && ci !== "" && ci !== "0" && ci !== "false") || env?.KEEL_FROZEN === "1";
}
