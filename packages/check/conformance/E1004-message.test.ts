// Spec: k.boundary, E1004's message "**E1004's message.** At the import, in the importing file. When a client entry reaches that file: `client code reaches server-only (<chain>)`, the shortest chain of files from the entry to the server-only file the import names (a package specifier when it names no project file), joined by ` -> `. When that passes 89 units, the files between the first and the last become one `...`, then the first loses leading segments, then the last (k.check Diagnostics). The middle is then not reported: the position names the importer, the ends name the entry and the server-only file, and the fix is at the importer. With no such chain (a file of a `node` module, or no `topology.ts`): `client code imports server-only <file>`. Examples: `client code reaches server-only (modules/a/Page.tsx -> lib/fmt.ts -> lib/keys.server.ts)` (88 units); a fourth file between them gives `client code reaches server-only (modules/a/Page.tsx -> ... -> lib/notes.server.ts)` (82)."
// Seed 1337 (the property). `check` over in-memory trees, type pass off. Node `api` lists module `a`; its `Page.tsx` is the route component, the entry.
// ASSUMPTIONS: the marker is one `.../` (k.check Diagnostics: `a/b/c.ts`, `.../b/c.ts`, `.../c.ts`), and the order is: middle files become `...` (three files or more), then the first path loses leading segments until the message fits or one is left, then the last. "The shortest chain" is a chain with no shortcut: each file imports only the next.
import fc from "fast-check";
import { posix } from "node:path";
import { describe, expect, test } from "vitest";
import { CONTRACT_A, ROUTES_A, diagsOf, file, nodeA, pageOf } from "./boundary-support.ts";
import { type Files, SEED } from "./support.ts";

const PREFIX = "client code reaches server-only (";
const e1004 = (files: Files) => diagsOf(files, "E1004");
const importFrom = (from: string, to: string): string => {
  const rel = posix.relative(posix.dirname(from), to);
  return `import '${rel.startsWith(".") ? rel : `./${rel}`}'\n`;
};
/** A project whose `Page.tsx` imports `chain[1]`, each plain file the next, the last being server-only. */
const chainProject = (chain: readonly string[]): Files => {
  const entry = "modules/a/Page.tsx";
  const all = [entry, ...chain];
  return nodeA([
    ROUTES_A,
    CONTRACT_A,
    pageOf(importFrom(entry, all[1] ?? ""), "export default function Page() {\n  return null\n}\n"),
    ...all.slice(1).map((p, i) => {
      const next = all[i + 2];
      return file(p, next === undefined ? "export const k = 1\n" : `${importFrom(p, next)}export const v = 1\n`);
    }),
  ]);
};
const whole = (chain: readonly string[]): string => `${PREFIX}${["modules/a/Page.tsx", ...chain].join(" -> ")})`;
const shown = (path: string, k: number): string => (k === 0 ? path : `.../${path.split("/").slice(k).join("/")}`);
/** The rule of the spec: whole if it fits; else the middle as `...`, then the first loses leading segments, then the last. */
const expected = (chain: readonly string[]): string => {
  const files = ["modules/a/Page.tsx", ...chain];
  const text = (xs: readonly string[]): string => `${PREFIX}${xs.join(" -> ")})`;
  if (text(files).length <= 89) return text(files);
  const first = files[0] ?? "";
  const last = files[files.length - 1] ?? "";
  const mid = files.length >= 3 ? ["..."] : [];
  const build = (kf: number, kl: number): string =>
    text([shown(first, kf), ...mid, ...(files.length >= 2 ? [shown(last, kl)] : [])]);
  const nf = first.split("/").length;
  const nl = last.split("/").length;
  for (let kf = 0; kf < nf; kf++) if (build(kf, 0).length <= 89) return build(kf, 0);
  for (let kl = 1; kl < nl; kl++) if (build(nf - 1, kl).length <= 89) return build(nf - 1, kl);
  return build(nf - 1, nl - 1);
};

describe("k.boundary: E1004's message", () => {
  test("`Page.tsx` -> `lib/fmt.ts` -> `lib/keys.server.ts` is `client code reaches server-only (modules/a/Page.tsx -> lib/fmt.ts -> lib/keys.server.ts)`, 88 units, at `lib/fmt.ts`", () => {
    const d = e1004(chainProject(["lib/fmt.ts", "lib/keys.server.ts"]));
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("lib/fmt.ts");
    expect(d[0]?.message).toBe(
      "client code reaches server-only (modules/a/Page.tsx -> lib/fmt.ts -> lib/keys.server.ts)",
    );
    expect(d[0]?.message.length).toBe(88);
  });

  test("a fourth file between them gives `client code reaches server-only (modules/a/Page.tsx -> ... -> lib/notes.server.ts)`, 82 units, at the last plain file", () => {
    const d = e1004(chainProject(["lib/fmt.ts", "lib/start.ts", "lib/notes.server.ts"]));
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("lib/start.ts");
    expect(d[0]?.message).toBe("client code reaches server-only (modules/a/Page.tsx -> ... -> lib/notes.server.ts)");
    expect(d[0]?.message.length).toBe(82);
  });

  test("a file importing a server-only file with no topology.ts is `client code imports server-only <file>`", () => {
    const d = e1004([
      file("db.server.ts", "export const db = 1\n"),
      file("C.tsx", "import { db } from './db.server.ts'\nexport default function C() { return db }\n"),
    ]);
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("client code imports server-only db.server.ts");
  });

  test("a file of a `node` module no client entry reaches, importing a server-only file, is `client code imports server-only <file>`", () => {
    const d = e1004(
      nodeA([
        file("modules/a/keys.server.ts", "export const k = 1\n"),
        file("modules/a/util.ts", "import { k } from './keys.server.ts'\nexport const u = k\n"),
      ]),
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("client code imports server-only modules/a/keys.server.ts");
  });

  test("for generated chains and path lengths the message is at most 89 units, never ends in `...`, holds the server file's tail, and is the whole chain when that fits", () => {
    const seg = fc.stringMatching(/^[a-z]{1,12}$/);
    const plain = fc.tuple(fc.array(seg, { maxLength: 3 }), seg).map(([dirs, n]) => `lib/${[...dirs, n].join("/")}.ts`);
    const server = fc
      .tuple(fc.array(seg, { maxLength: 3 }), seg)
      .map(([dirs, n]) => `lib/${[...dirs, n].join("/")}.server.ts`);
    fc.assert(
      fc.property(fc.uniqueArray(plain, { minLength: 1, maxLength: 4 }), server, (mid, last) => {
        const chain = [...mid, last];
        fc.pre(new Set(chain).size === chain.length);
        const d = e1004(chainProject(chain));
        expect(d).toHaveLength(1);
        const m = d[0]?.message ?? "";
        expect(m.length).toBeLessThanOrEqual(89);
        expect(m.endsWith("...")).toBe(false);
        expect(m.startsWith(PREFIX)).toBe(true);
        expect(m.endsWith(`${last.split("/").at(-1) ?? ""})`)).toBe(true);
        expect(m).toBe(expected(chain));
      }),
      { seed: SEED, numRuns: 60 },
    );
  });
});
