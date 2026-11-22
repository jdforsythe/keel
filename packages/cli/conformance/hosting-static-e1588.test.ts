// Spec: k.hosting, Conformance "The same fixture with a route whose loader returns `err` (`keel.notFound`) exits 1 with one E1588 naming that route id and 404."
// Spec: k.hosting, Rules "E1588 a `static` route whose build GET answers other than 200 (names the route id and status)"
// Seed: 1337 (no generated input: one fixture per variant; see static-support.ts).
// ASSUMPTION: the diagnostic message names the route id `s.about` and the status as decimal digits; only the `keel.notFound` status (404) is named by the spec,
// so a guard that denies or a throw is asserted to give one E1588 naming the route id and some three-digit status other than 200.
import { afterAll, beforeAll, expect, test } from "vitest";
import { cleanup, diags, keel, materialize } from "./compat-support.ts";
import { type Failing, SLOW, staticTree } from "./static-support.ts";

const dirs = new Map<Failing, string>();
const variants: readonly Failing[] = ["notFound", "denied", "throws", "none"];
beforeAll(() => {
  for (const v of variants) dirs.set(v, materialize(staticTree(v)));
}, SLOW);
afterAll(() => {
  for (const d of dirs.values()) cleanup(d);
});
const dirOf = (v: Failing): string => dirs.get(v) ?? "";

test(
  "The same fixture with a route whose loader returns `err` (`keel.notFound`) exits 1 with one E1588 naming that route id and 404.",
  () => {
    const r = keel(dirOf("notFound"), ["build"]);
    expect(r.status).toBe(1);
    const d = diags(r, "E1588");
    expect(d).toHaveLength(1);
    expect(String(d[0]?.message)).toContain("s.about");
    expect(String(d[0]?.message)).toContain("404");
  },
  SLOW,
);

test(
  "E1588 a `static` route whose build GET answers other than 200 (names the route id and status): a guard that denies caller '' and a loader that throws each fail the build; all-200 does not.",
  () => {
    for (const v of ["denied", "throws"] as const) {
      const r = keel(dirOf(v), ["build"]);
      expect(r.status, v).toBe(1);
      const d = diags(r, "E1588");
      expect(d, v).toHaveLength(1);
      const m = String(d[0]?.message);
      expect(m, v).toContain("s.about");
      expect(m, v).toMatch(/\b(?!200\b)[1-5]\d\d\b/); // a status other than 200 (the message may also name 200 as what is needed)
    }
    const ok = keel(dirOf("none"), ["build"]);
    expect(ok.status).toBe(0);
    expect(diags(ok, "E1588")).toEqual([]);
  },
  SLOW,
);
