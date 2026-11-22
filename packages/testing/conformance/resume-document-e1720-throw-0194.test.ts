// @vitest-environment happy-dom
// Spec: k.testing, Rules "E1720 (`resumeDocument`; a throw while an island claims is named with its thrown text, as the harness shows what a page threw while resuming)" (rfc:0194)
// Spec: k.testing, Conformance "an island whose component throws `new Error('boom')` while claiming is E1720 whose text holds `boom`."
// Seed: 1337 (fc.assert below). The island document is written as in resume-document-0092.test.ts; the route's component is the thrower.
// ASSUMPTION: "text" is the rejection's `message`.
import type { Ctx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { resumeDocument } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { codeOf, messageOf, SEED, simCtx, thrown } from "./fixtures.ts";

const ROUTE = "rt.page";
const documentOf = (): string =>
  `<!doctype html><html><head><title>t</title></head><body><div id="rt.root" data-k-island="${ROUTE}"></div><script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { [ROUTE]: {} } })}</script></body></html>`;

const throwing = (text: string) => {
  const component = (_p: Readonly<Record<string, unknown>>, _ctx: Ctx): Node => {
    throw new Error(text);
  };
  return manifest(contract("rt", { [ROUTE]: { path: "/rt" } }), { [ROUTE]: { component } });
};

test("an island whose component throws `new Error('boom')` while claiming is E1720 whose text holds `boom`", async () => {
  const err = await thrown(() => resumeDocument(documentOf(), { routes: throwing("boom"), ctx: simCtx() }));
  expect(codeOf(err)).toBe("E1720");
  expect(messageOf(err)).toContain("boom");
});

test("for any thrown text, the E1720 of an island that throws while claiming holds it", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z][a-z0-9]{3,12}$/), async (text) => {
      const err = await thrown(() => resumeDocument(documentOf(), { routes: throwing(text), ctx: simCtx() }));
      expect(codeOf(err)).toBe("E1720");
      expect(messageOf(err)).toContain(text);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
