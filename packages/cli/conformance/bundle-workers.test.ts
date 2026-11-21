// Spec: k.bundle, Conformance "In a `node` fixture whose `lib/notes.server.ts` holds a canary and `lib/w.ts` imports it: a page starting `new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })`, and one importing `../../lib/w.ts?worker`, ship no canary under `dist/<name>/`; `keel check` reports E1004 at `lib/w.ts` naming the chain; a worker importing `notes.server.ts?raw` fails `vite build` with one E1007 whose chain runs through the worker."
// Spec: k.bundle, Bundles "Each bundle a browser build emits is a browser build for k.boundary, with the stubs and the Assertion: the entry's, each Web Worker's and shared worker's (`new Worker(new URL(<literal>, import.meta.url))`, `new SharedWorker(…)`, an import with `?worker` or `?sharedworker`) and any other chunk Vite bundles in a pass of its own. A worker's chain runs through the file that names it: `<entry> -> <page> -> <worker> -> … -> <file>`."
// Seed 1337 (no random input: each spelling of a worker is enumerated). `vite build` with `KEEL_DEPLOYABLE=api` over a temp project (it runs no check), and the real `keel check` over the same files.
// Every emitted file under `dist/api/` is searched for the canary, worker chunks included; `w.ts` also posts a marker so a missing worker chunk cannot make the search pass by emptiness.
// The page starts each worker inside a function it never calls, so `routes.ts`'s evaluation in Node does not need a `Worker` global.
// The chain step that names the worker may carry its `?worker` query; the tests compare the file.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { filesHolding, filesUnder, keelRun, linesWith, viteBuild } from "./boundary-support.ts";
import { ALIVE, CANARY_NOTES, REF, bare, chainOf, inProject, nodeWith, page, reasonOf } from "./bundle-support.ts";

const keysOf = <T extends object>(o: T): (keyof T)[] => {
  const out: (keyof T)[] = [];
  for (const k in o) out.push(k);
  return out;
};
const NOTES = `export const notes = '${CANARY_NOTES}'\n`;
const W = `import { notes } from './notes.server.ts'\nself.postMessage(['${ALIVE}', notes])\n`;

const SPELLINGS = {
  "new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })": {
    imports: "",
    stmt: "() => new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })",
  },
  "new SharedWorker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })": {
    imports: "",
    stmt: "() => new SharedWorker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })",
  },
  "import W from '../../lib/w.ts?worker'": {
    imports: "import W from '../../lib/w.ts?worker'",
    stmt: "() => new W()",
  },
} as const;

const fixture = (spelling: keyof typeof SPELLINGS, worker: string) => {
  const s = SPELLINGS[spelling];
  return nodeWith({
    "lib/notes.server.ts": NOTES,
    "lib/w.ts": worker,
    "modules/a/Page.tsx": page(s.imports, s.stmt),
  });
};

describe("k.bundle: a worker a page starts ships no server-only code", () => {
  for (const spelling of keysOf(SPELLINGS)) {
    test(`\`${spelling}\` in \`Page.tsx\`, with \`lib/w.ts\` importing \`lib/notes.server.ts\`: the build exits 0, a worker chunk is emitted and the canary is in no file under \`dist/api/\``, async () => {
      await inProject(fixture(spelling, W), (dir) => {
        const r = viteBuild(dir, "api");
        expect(r.status, r.out).toBe(0);
        expect(linesWith(r.out, "E1007")).toEqual([]);
        expect(filesHolding(join(dir, "dist", "api"), ALIVE)).not.toEqual([]);
        expect(filesHolding(join(dir, "dist", "api"), CANARY_NOTES)).toEqual([]);
      });
    });
  }

  for (const spelling of keysOf(SPELLINGS)) {
    test(`\`keel check\` of the \`${spelling}\` fixture reports E1004 at \`lib/w.ts\` naming the chain`, async () => {
      await inProject(fixture(spelling, W), (dir) => {
        const r = keelRun(dir, ["check"]);
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, '"E1004"').filter((l) => l.includes("lib/w.ts"));
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.join("\n")).toContain("modules/a/Page.tsx");
        expect(hits.join("\n")).toContain("lib/notes.server.ts");
      });
    });
  }
});

describe("k.bundle: a server-only file a worker imports fails the build with one E1007 whose chain runs through the worker", () => {
  const RAW_W = `${REF}import src from './notes.server.ts?raw'\nself.postMessage(src)\n`;
  for (const spelling of keysOf(SPELLINGS)) {
    test(`\`${spelling}\` with \`lib/w.ts\` importing \`./notes.server.ts?raw\`: exit 1, one E1007 \`server-only file\`, a chain ending \`modules/a/Page.tsx -> lib/w.ts -> lib/notes.server.ts?raw\`, nothing written`, async () => {
      const files = fixture(spelling, RAW_W);
      await inProject(files, (dir) => {
        const r = viteBuild(dir, "api");
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, "E1007");
        expect(hits).toHaveLength(1);
        expect(reasonOf(hits[0] ?? "")).toBe("server-only file");
        const chain = chainOf(hits[0] ?? "").map(bare);
        expect(chain.slice(-3)).toEqual(["modules/a/Page.tsx", "lib/w.ts", "lib/notes.server.ts?raw"]);
        expect(existsSync(join(dir, "dist", "api"))).toBe(false);
        expect(filesUnder(join(dir, "dist"))).toEqual([]);
      });
    });
  }

  test("a worker that imports a Node built-in fails the build with one E1007 `node built-in` whose chain runs through the worker", async () => {
    const worker = "import { join } from 'node:path'\nself.postMessage(join('a', 'b'))\n";
    await inProject(
      fixture("new Worker(new URL('../../lib/w.ts', import.meta.url), { type: 'module' })", worker),
      (dir) => {
        const r = viteBuild(dir, "api");
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, "E1007");
        expect(hits).toHaveLength(1);
        expect(reasonOf(hits[0] ?? "")).toBe("node built-in");
        expect(chainOf(hits[0] ?? "").slice(-3)).toEqual(["modules/a/Page.tsx", "lib/w.ts", "node:path"]);
      },
    );
  });
});
