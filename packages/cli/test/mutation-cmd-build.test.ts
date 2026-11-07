// Mutation-killing tests for build, check, explain and the operations execute routes to.
import { explain } from "@keel/check";
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
  it("counts only app sources: no tests, no *.config.* files, nothing under .keel/", () => {
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
      ok("config.ts", "Cfg"),
    ];
    const o = buildCommand({ cwd: CWD, files });
    expect(o.records.at(-1)).toMatchObject({
      kind: "summary",
      name: "build",
      counts: { files: 5, artifacts: 4, errors: expect.any(Number) },
    });
  });

  it("a root-level config file and a project with only tests contribute no files", () => {
    const o = buildCommand({ cwd: CWD, files: [ok("vite.config.ts", "V"), ok("a.test.ts", "T")] });
    expect(o.records.at(-1)).toEqual({
      kind: "summary",
      ok: true,
      name: "build",
      counts: { files: 0, artifacts: 4, errors: 0 },
    });
  });

  it("writes each artifact at .keel/<name>.json as canonical { data, hash } plus one newline, read-only", () => {
    const o = buildCommand({ cwd: CWD, files: [ok("src/A.ts", "A")] });
    expect(o.writes.map((w) => w.path)).toEqual([
      ".keel/a11y.json",
      ".keel/deps.json",
      ".keel/ids.json",
      ".keel/styles.json",
    ]);
    for (const w of o.writes) {
      expect(w.readonly).toBe(true);
      expect(w.content).toMatch(/^\{"data":.*,"hash":"[^"]+"\}\n$/);
    }
  });

  it("an error diagnostic flows through with its location and see; nothing is written; errors are counted", async () => {
    const r = await run(["build", "--format=json"], { cwd: CWD, files: [BAD] });
    expect(r).toEqual({
      code: 1,
      stdout:
        '{"kind":"diag","code":"E1003","path":"src/C.tsx","line":1,"col":41,"message":"href is a literal script/data URL; it renders as about:blank","see":"k.compiler","fix":"--- a/src/C.tsx\\n+++ b/src/C.tsx\\n@@ -1,1 +1,1 @@\\n-export default function C() { return <a href=\\"javascript:alert(1)\\">x</a> }\\n+export default function C() { return <a>x</a> }"}\n{"kind":"summary","ok":false,"name":"build","counts":{"files":1,"artifacts":0,"errors":1}}\n',
      stderr: "",
    });
    const o = buildCommand({ cwd: CWD, files: [BAD, ok("src/A.ts", "A")] });
    expect(o.writes).toEqual([]);
    expect(o.records.at(-1)).toEqual({
      kind: "summary",
      ok: false,
      name: "build",
      counts: { files: 2, artifacts: 0, errors: 1 },
    });
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
  it("no code is an empty result", () => {
    expect(explainCommand({})).toEqual([{ kind: "summary", ok: true, name: "explain", counts: { codes: 0 } }]);
  });

  it("a known code yields its explain text and a named trailer", () => {
    expect(explainCommand({ code: "E1757" })).toEqual([
      { kind: "explain.text", code: "E1757", text: explain("E1757").trim() },
      { kind: "summary", ok: true, name: "explain E1757", counts: {} },
    ]);
  });

  it("clips to the 120-token budget with an ellipsis, trailer included", async () => {
    const code = "x".repeat(150);
    const full = explain(code).trim();
    const room = 480 - (`ok explain ${code}\n`.length + 1);
    const recs = explainCommand({ code });
    expect(recs[0]).toEqual({ kind: "explain.text", code, text: `${full.slice(0, room - 3)}...` });
    expect(room).toBe(317);
    const r = await run(["explain", code], { cwd: CWD });
    expect(r.stdout).toBe(`${full.slice(0, 314)}...\nok explain ${code}\n`);
    expect(r.stdout.length).toBe(317 + 1 + `ok explain ${code}\n`.length);
  });

  it("text exactly at the budget is not clipped", () => {
    // explain trims leading blanks of the code, so the text can be made as long as the room exactly.
    const at = ` ${"x".repeat(133)}`;
    const text = explain(at).trim();
    const room = 480 - (`ok explain ${at}\n`.length + 1);
    expect(text.length).toBe(room);
    expect(explainCommand({ code: at })[0]).toEqual({ kind: "explain.text", code: at, text });
  });
});

describe("operations that are not available in-process", () => {
  it("dev, inspect and render are exact I1055 results", async () => {
    expect((await run(["dev"], { cwd: CWD })).stdout).toBe(
      "I1055 dev not available: needs vite.config.ts and the keel binary (vite dev server)\n  see: k.server\nok dev\n",
    );
    expect((await run(["inspect"], { cwd: CWD })).stdout).toBe(
      "I1055 inspect not available: needs a network (io.fetch)\n  see: k.cli\nok inspect\n",
    );
    expect((await run(["render"], { cwd: CWD })).stdout).toBe(
      "I1055 render not available: needs a compiled component or route loader\n  see: k.testing\nok render\n",
    );
    expect((await run(["session"], { cwd: CWD })).stdout).toBe(
      "I1055 session not available: needs the stdlib sessions module\n  see: k.cli\nok session\n",
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
