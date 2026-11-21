// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { callerCookie } from "../src/callerCookie.ts";

const token = fc.stringMatching(/^[A-Za-z0-9._-]{1,24}$/);
const host = fc.stringMatching(/^[a-z]{1,8}(\.[a-z]{2,4})?(\/[a-z]{0,6})?$/);

test("an https url gets the __Host- cookie and any other url the plain one, each holding the token as given", () => {
  fc.assert(
    fc.property(token, host, (t, h) => {
      expect(callerCookie(`https://${h}`, t)).toBe(`__Host-keel-caller=${t}`);
      expect(callerCookie(`http://${h}`, t)).toBe(`keel-caller=${t}`);
      expect(callerCookie(h, t)).toBe(`keel-caller=${t}`);
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("an absent or empty token gives no cookie", () => {
  fc.assert(
    fc.property(host, (h) => {
      expect(callerCookie(`https://${h}`, undefined)).toBeUndefined();
      expect(callerCookie(`https://${h}`, "")).toBeUndefined();
      expect(callerCookie(`http://${h}`, "")).toBeUndefined();
    }),
    { seed: 1337, numRuns: 25 },
  );
});
