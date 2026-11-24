// Mutation-killing tests for build, check, explain and the operations execute routes to.
import { explain } from "@keel/check/explain";
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { buildCommand } from "../src/internal/buildCommand.ts";
import { explainCommand } from "../src/internal/explainCommand.ts";

const CWD = "/work/app";
const ok = (path: string, name: string) => ({ path, source: `export const ${name} = 1\n` });
const BAD = {
  path: "src/C.tsx",
  source: 'export default function C() { return <a href="javascript:alert(1)">x</a> }\n',
};

describe("build", () => {
  it("counts only app sources (isSourcePath): no tests or test dirs, no *.config.*, no dot dirs", async () => {
    const files = [
      ok("src/A.ts", "A"),
      ok("src/B.test.ts", "B"),
      ok("vite.config.ts", "V"),
      ok("src/x.config.mjs", "X"),
      ok("src/y.config.cts", "Y"),
      ok("src/app.admin.config.ts", "Z"),
      ok("nested/dir.config.js", "W"),
      ok(".keel/g.ts", "G"),
      ok("src/D.config.tsx", "D"),
      ok("src/K.configs.ts", "K"),
      ok("src/.keel/H.ts", "H"),
      ok("config.ts", "config"),
      ok("test/fixtures/W.tsx", "W2"),
      ok("conformance/c.ts", "C"),
    ];
    const o = await buildCommand({ cwd: CWD, files });
    // src/A.ts, src/K.configs.ts, config.ts
    expect(o.records.at(-1)).toMatchObject({
      kind: "summary",
      name: "build",
      counts: { files: 3, artifacts: 5, errors: expect.any(Number) },
    });
  });

  it("keel build then keel check: no E1005 with ids in test/fixtures and a *.config.ts (backlog 0142)", async () => {
    const files = [
      {
        path: "modules/app/Home.tsx",
        source:
          'import { Box } from "@keel/ui"\nexport default function Home() { return <Box id="home.title">Hi</Box> }\n',
      },
      // The sandbox has no `@keel/ui` to resolve, so the file's import is typed here.
      {
        path: "modules/app/uiTypes.ts",
        source: 'declare module "@keel/ui" { export function Box(p: { id: string; children?: string }): null }\n',
      },
      {
        path: "test/fixtures/Widget.tsx",
        source: 'export default function Widget() { return <h1 id="fixture.title">W</h1> }\n',
      },
      { path: "tools.config.ts", source: "export default {}\n" },
      { path: "vite.config.tsx", source: 'export const x = <p id="cfg.p">c</p>\n' },
    ];
    const built = await buildCommand({ cwd: CWD, files });
    expect(built.writes.length).toBe(5);
    const artifacts = built.writes.map((w) => ({ path: w.path, source: w.content ?? "" }));
    const ids = artifacts.find((a) => a.path === ".keel/ids.json")?.source ?? "";
    expect(ids).toContain("home.title");
    expect(ids).not.toContain("fixture.title");
    const r = await run(["check", "--format=json"], { cwd: CWD, files: [...files, ...artifacts] });
    expect(r.stdout).not.toContain("E1005");
    // and the stale case still holds: a source edit after the build is E1005
    const moved = files.map((f) =>
      f.path === "modules/app/Home.tsx" ? { ...f, source: f.source.replace('id="home.title"', 'id="home.t2"') } : f,
    );
    const stale = await run(["check", "--format=json"], { cwd: CWD, files: [...moved, ...artifacts] });
    expect(stale.stdout).toContain("E1005");
  });

  it("a root-level config file and a project with only tests contribute no files", async () => {
    const o = await buildCommand({ cwd: CWD, files: [ok("vite.config.ts", "V"), ok("a.test.ts", "T")] });
    expect(o.records.at(-1)).toEqual({
      kind: "summary",
      ok: true,
      name: "build",
      counts: { files: 0, artifacts: 5, errors: 0 },
    });
  });

  it("writes each artifact at .keel/<name>.json as canonical { data, hash } plus one newline, read-only", async () => {
    const o = await buildCommand({ cwd: CWD, files: [ok("src/A.ts", "A")] });
    expect(o.writes.map((w) => w.path)).toEqual([
      ".keel/a11y.json",
      ".keel/deps.json",
      ".keel/ids.json",
      ".keel/styles.json",
      ".keel/std.json",
    ]);
    for (const w of o.writes) {
      expect(w.readonly).toBe(true);
      expect(w.content).toMatch(/^\{"data":.*,"hash":"[^"]+"\}\n$/);
    }
  });

  it("an error diagnostic stops the build at keel check with its location and see; nothing is written; errors are counted", async () => {
    const r = await run(["build", "--format=json"], { cwd: CWD, files: [BAD] });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(
      '{"kind":"diag","code":"E1003","path":"src/C.tsx","line":1,"col":41,"message":"href is a literal script/data URL; it renders as about:blank","see":"k.compiler","fix":"--- a/src/C.tsx\\n+++ b/src/C.tsx\\n@@ -1,1 +1,1 @@\\n-export default function C() { return <a href=\\"javascript:alert(1)\\">x</a> }\\n+export default function C() { return <a>x</a> }"}\n',
    );
    expect(r.stdout.trimEnd().split("\n").at(-1)).toContain('"kind":"summary","ok":false');
    expect(r.stderr).toBe("");
    const o = await buildCommand({ cwd: CWD, files: [BAD, ok("src/A.ts", "A")] });
    expect(o.writes).toEqual([]);
    expect(o.records.at(-1)).toMatchObject({ kind: "summary", ok: false });
  });
});

describe("check", () => {
  it("summary counts files, errors and warnings exactly", async () => {
    const files = [{ path: "src/a.ts", source: "export const a = 1\nexport const b = 2\n" }, ok("src/c.ts", "c")];
    const r = await run(["check", "--format=json"], { cwd: CWD, files });
    expect(r.stdout).toBe(
      '{"kind":"diag","code":"E1752","path":"src/a.ts","line":2,"col":1,"message":"2 exports in one file (a, b); one export per file","see":"k.check"}\n{"kind":"summary","ok":false,"name":"check","counts":{"files":2,"errors":1,"warnings":0}}\n',
    );
    expect((await run(["check"], { cwd: CWD, files: [ok("src/c.ts", "c")] })).stdout).toBe(
      "ok check 1 files, 0 errors, 0 warnings\n",
    );
  });
});

describe("explain", () => {
  it("no code is an empty result", async () => {
    expect(await explainCommand({})).toEqual([{ kind: "summary", ok: true, name: "explain", counts: { codes: 0 } }]);
  });

  it("a known code yields its explain text and a named trailer", async () => {
    expect(await explainCommand({ code: "E1757" })).toEqual([
      { kind: "explain.text", code: "E1757", text: explain("E1757").trim() },
      { kind: "summary", ok: true, name: "explain E1757", counts: {} },
    ]);
  });

  it("clips to the 120-token budget with an ellipsis, trailer included", async () => {
    const code = "x".repeat(150);
    const full = explain(code).trim();
    const room = 480 - (`ok explain ${code}\n`.length + 1);
    const recs = await explainCommand({ code });
    expect(recs[0]).toEqual({ kind: "explain.text", code, text: `${full.slice(0, room - 3)}...` });
    expect(room).toBe(317);
    const r = await run(["explain", code], { cwd: CWD });
    expect(r.stdout).toBe(`${full.slice(0, 314)}...\nok explain ${code}\n`);
    expect(r.stdout.length).toBe(317 + 1 + `ok explain ${code}\n`.length);
  });

  it("text exactly at the budget is not clipped", async () => {
    // explain trims leading blanks of the code, so the text can be made as long as the room exactly.
    const at = ` ${"x".repeat(133)}`;
    const text = explain(at).trim();
    const room = 480 - (`ok explain ${at}\n`.length + 1);
    expect(text.length).toBe(room);
    expect((await explainCommand({ code: at }))[0]).toEqual({ kind: "explain.text", code: at, text });
  });
});

describe("operations that are not available in-process", () => {
  it("dev, inspect and render are exact I1055 results", async () => {
    expect((await run(["dev"], { cwd: CWD })).stdout).toBe(
      "I1055 dev not available: needs vite.config.ts and the keel binary (vite dev server)\n  see: keel docs k.server\nok dev\n",
    );
    expect((await run(["inspect"], { cwd: CWD })).stdout).toBe(
      "I1055 inspect not available: needs a network (io.fetch)\n  see: keel docs k.cli\nok inspect\n",
    );
    expect((await run(["render"], { cwd: CWD })).stdout).toBe(
      "I1055 render not available: needs a compiled component or route loader\n  see: keel docs k.testing\nok render\n",
    );
    expect((await run(["session"], { cwd: CWD })).stdout).toBe(
      "I1055 session not available: needs the stdlib session module\n  see: keel docs k.cli\nok session\n",
    );
  });

  it("inspect with a network goes to inspectCommand, not the unavailable stub", async () => {
    const r = await run(["inspect", "http://h:1"], {
      cwd: CWD,
      fetch: async () => new Response("nope", { status: 500 }),
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/^E1056 inspect target answered 500: http:\/\/h:1\n/);
  });
});
