// @vitest-environment node
// Spec: k.e2e, clause "In a library folder holding `src/Card.ts` and `@keel/compiler`, `@keel/router` and `@keel/server` in `devDependencies`, `serve({ page: 'src/Card.ts', props: { title: 'Hi' } })` serves a page whose `find('card.title')` text is `Hi`; without `@keel/router` it rejects E1737 naming `@keel/router`."
// k.e2e Rules E1737 (a host package missing) is asserted by the second part of the case.
// Seed: n/a (no generated input). Method: as e2e-serve.test.ts: a library folder (package.json `"keel": "library"`, `module.ts`, `src/Card.ts`, `tokens.ts`) whose e2e file runs under `keel test --e2e`; the run's report is read.
// The cases need Chromium (e2e-support.ts); none skips. Both libraries link every `@keel/*` package of the workspace but the one `omit` names, and list the packages their `devDependencies` hold.
// ASSUMED: (1) `Card.ts` is a plain `.ts` file, so it calls `Box` and `Text` as functions and its default export is named `Card`; (2) E1161 (an id built on `props.id`) holds in a library, so `Card` takes its `id` from `props` and the case
// passes `props: { id: 'card', title: 'Hi' }`: the clause's `props: { title: 'Hi' }` gives `Card` no `id` to build `card.title` on, and the spec does not say the host supplies one (AMBIGUOUS); (3) `.keel/e2e-host-<random>/topology.ts` names the
// deployable `web`; (4) `serve`'s `page` is a path (k.e2e Libraries), so the case does not type-check against a `page` typed as a component.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { library } from "./e2e-library-support.ts";
import { type Run, cleanup, keelE2e, outcome, project, reasons, suite } from "./e2e-support.ts";
import { fixedTime } from "@keel/tooling/test-time";

const withRouter = suite(
  ["import { readFileSync, readdirSync } from 'node:fs'", "import { serve } from '@keel/testing/e2e'"],
  [
    {
      title: "a library page is served by its host project",
      body: `const app = await serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' } })
const page = await app.open('/')
expect((await page.find('card.title')).text).toBe('Hi')
const hosts = readdirSync('.keel').filter((n) => /^e2e-host-/.test(n))
expect(hosts).toHaveLength(1)
expect(readFileSync('.keel/' + hosts[0] + '/topology.ts', 'utf8')).toContain('web')
await app.dispose()
expect(readdirSync('.keel').filter((n) => /^e2e-host-/.test(n))).toEqual([])`,
    },
  ],
);
const withoutRouter = suite(
  ["import { serve } from '@keel/testing/e2e'", "import { failure } from './failure.ts'"],
  [
    {
      title: "a library without the router is E1737 naming it",
      body: `const e = await failure(serve({ page: 'src/Card.ts', props: { id: 'card', title: 'Hi' } }))
expect(e.code).toBe('E1737')
expect(e.message).toContain('@keel/router')`,
    },
  ],
);

const FILE = "test/card.e2e.ts";
let withDir = "";
let withoutDir = "";
const runs = new Map<string, Run>();

beforeAll(() => {
  withDir = project({ ...library(undefined), [FILE]: withRouter.source });
  withoutDir = project({ ...library("@keel/router"), [FILE]: withoutRouter.source }, { omit: ["router"] });
  runs.set("with", keelE2e(withDir));
  runs.set("without", keelE2e(withoutDir));
}, fixedTime(3_000_000));
afterAll(cleanup);

const why = (key: string): string => reasons(runs.get(key));

describe("k.e2e libraries", () => {
  it("In a library folder holding `src/Card.ts` and `@keel/compiler`, `@keel/router` and `@keel/server` in `devDependencies`, `serve({ page: 'src/Card.ts', props: { title: 'Hi' } })` serves a page whose `find('card.title')` text is `Hi`; without `@keel/router` it rejects E1737 naming `@keel/router`", () => {
    const line = withRouter.lines["a library page is served by its host project"];
    expect(outcome(withDir, FILE, line ?? 0), why("with")).toBe("passed");
    const other = withoutRouter.lines["a library without the router is E1737 naming it"];
    expect(outcome(withoutDir, FILE, other ?? 0), why("without")).toBe("passed");
  });
});
