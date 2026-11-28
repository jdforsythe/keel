// k.data Dev: under `keel dev` a file that ran a capability's registration, itself or through a helper it called,
// is found in the stacks `register` recorded, as a path or a `file:` URL; a file merely sharing a prefix is not.
import { pathToFileURL } from "node:url";
import fc from "fast-check";
import { expect, test } from "vitest";
import { registeredIn } from "../src/internal/registeredIn.ts";

const FC = { seed: 1337, numRuns: 50 };
const seg = fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);
const file = fc
  .tuple(fc.array(seg, { minLength: 1, maxLength: 3 }), seg)
  .map(([dirs, f]) => `/app/${dirs.join("/")}/${f}.server.ts`);
const frame = (at: string): string => `    at ${at}:3:14`;

test("property: a declaring file and a helper on the stack are found, as paths or file URLs, with or without a query", () => {
  fc.assert(
    fc.property(file, file, fc.boolean(), fc.constantFrom("", "?t=1"), (declarer, helper, url, query) => {
      const shown = (f: string): string => (url ? pathToFileURL(f).href : f) + query;
      const stack = [
        "Error: t.db",
        frame("register (/repo/packages/ctx/src/register.ts"),
        frame(shown(helper)),
        `    at async ${shown(declarer)}:1:1`,
      ].join("\n");
      expect(registeredIn([stack], declarer)).toBe(true);
      expect(registeredIn(["Error: other", frame("/elsewhere/x.ts")], declarer)).toBe(false);
      expect(registeredIn([stack], helper)).toBe(true);
    }),
    FC,
  );
});

test("a file whose path is a prefix of a frame's file is not found", () => {
  expect(registeredIn([frame("/app/m/db.server.tsx")], "/app/m/db.server.ts")).toBe(false);
  expect(registeredIn(["    at (/app/m/db.server.ts)"], "/app/m/db.server.ts")).toBe(true);
});
