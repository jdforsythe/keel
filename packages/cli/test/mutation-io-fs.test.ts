// Mutation-killing tests for the binary-only filesystem helpers: readProject, applyWrites, hostIo, viteRun.
// Every test works in a fresh temp directory under the OS tmpdir, never inside the repo.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyWrites } from "../src/internal/applyWrites.ts";
import { hostIo } from "../src/internal/hostIo.ts";
import { readProject } from "../src/internal/readProject.ts";
import { viteRun } from "../src/internal/viteRun.ts";

const made: string[] = [];
const tmp = (): string => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "keel-mut-io-")));
  made.push(d);
  return d;
};
const put = (root: string, rel: string, text: string): void => {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
};
const paths = (xs: readonly { path: string }[]): string[] => xs.map((x) => x.path);
const mode = (p: string): number => statSync(p).mode & 0o777;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const d of made.splice(0)) {
    for (const f of [d]) rmSync(f, { recursive: true, force: true });
  }
});

describe("readProject", () => {
  it("an empty directory has no files", () => {
    const d = tmp();
    expect(readProject(d, "query")).toEqual([]);
    expect(readProject(d, "tree")).toEqual([]);
  });

  it("query scope: code, spec markdown, .keel json and the ledger only; contents verbatim", () => {
    const d = tmp();
    put(d, "src/a.ts", "A");
    put(d, "src/b.tsx", "B");
    put(d, "src/c.mjs", "C");
    put(d, "src/d.json", "{}");
    put(d, "README.md", "r");
    put(d, "spec/x.md", "SX");
    put(d, "spec/sub/y.md", "SY");
    put(d, "spec/z.txt", "z");
    put(d, "spec/z.mdx", "z");
    put(d, "myspec/w.md", "w");
    put(d, "spec.md", "w");
    put(d, ".keel/a.json", "KA");
    put(d, ".keel/a.txt", "x");
    put(d, "other/.keel/b.json", "x");
    put(d, "keel/c.json", "x");
    put(d, "tooling/ledger/ledger.json", "L");
    put(d, "tooling/ledger/other.json", "x");
    put(d, "ledger.json", "x");
    put(d, "package.json", "{}");
    expect(readProject(d, "query")).toEqual([
      { path: ".keel/a.json", source: "KA" },
      { path: "spec/sub/y.md", source: "SY" },
      { path: "spec/x.md", source: "SX" },
      { path: "src/a.ts", source: "A" },
      { path: "src/b.tsx", source: "B" },
      { path: "src/c.mjs", source: "C" },
      { path: "tooling/ledger/ledger.json", source: "L" },
    ]);
  });

  it("query scope leaves out build configuration anywhere but keeps look-alikes", () => {
    const d = tmp();
    put(d, "vite.config.ts", "x");
    put(d, "vitest.config.ts", "x");
    put(d, "stryker.config.mjs", "x");
    put(d, "pkg/vite.config.js", "x");
    put(d, "pkg/vitest.config.cts", "x");
    put(d, "myvite.config.ts", "keep");
    put(d, "vite.config.ts.d.ts", "keep2");
    put(d, "vite-config.ts", "keep3");
    put(d, "vite.config.json", "x");
    expect(paths(readProject(d, "query"))).toEqual(["myvite.config.ts", "vite-config.ts", "vite.config.ts.d.ts"]);
  });

  it("tree scope keeps build configuration and every text file type, and drops other files", () => {
    const d = tmp();
    for (const ext of [
      "ts",
      "tsx",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "mts",
      "cts",
      "json",
      "md",
      "yaml",
      "yml",
      "css",
      "html",
      "txt",
    ])
      put(d, `f.${ext}`, ext);
    put(d, "vite.config.ts", "v");
    put(d, "image.png", "x");
    put(d, "lock.lockb", "x");
    put(d, "a.ts.bak", "x");
    put(d, "ts", "x");
    put(d, "xts", "x");
    expect(paths(readProject(d, "tree"))).toEqual([
      "f.cjs",
      "f.css",
      "f.cts",
      "f.html",
      "f.js",
      "f.json",
      "f.jsx",
      "f.md",
      "f.mjs",
      "f.mts",
      "f.ts",
      "f.tsx",
      "f.txt",
      "f.yaml",
      "f.yml",
      "vite.config.ts",
    ]);
    expect(readProject(d, "tree").find((f) => f.path === "f.yml")?.source).toBe("yml");
  });

  it("tree scope reads files up to exactly 1 MB and skips larger ones", () => {
    const d = tmp();
    put(d, "exact.txt", "x".repeat(1_000_000));
    put(d, "over.txt", "x".repeat(1_000_001));
    put(d, "small.txt", "s");
    expect(paths(readProject(d, "tree"))).toEqual(["exact.txt", "small.txt"]);
  });

  it("the size limit is a tree-scope concern only: query reads a large code file", () => {
    const d = tmp();
    put(d, "big.ts", "x".repeat(1_000_001));
    expect(readProject(d, "query")[0]?.source.length).toBe(1_000_001);
  });

  it("skips tooling directories at every depth in both scopes", () => {
    const d = tmp();
    const skip = ["node_modules", "dist", "coverage", "reports", ".turbo", ".git", ".worktrees"];
    for (const s of skip) {
      put(d, `${s}/in.ts`, "x");
      put(d, `nested/${s}/in.ts`, "x");
    }
    put(d, "nested/keep.ts", "k");
    put(d, "distance/keep.ts", "k2");
    put(d, "node_modules_x/keep.ts", "k3");
    for (const scope of ["query", "tree"] as const)
      expect(paths(readProject(d, scope))).toEqual(["distance/keep.ts", "nested/keep.ts", "node_modules_x/keep.ts"]);
  });

  it("orders entries by name within each directory, depth first, with paths relative to the root", () => {
    const d = tmp();
    put(d, "z.ts", "1");
    put(d, "a.ts", "2");
    put(d, "m/y.ts", "3");
    put(d, "m/b/c.ts", "4");
    put(d, "m/a.ts", "5");
    put(d, "b.ts", "6");
    expect(paths(readProject(d, "query"))).toEqual(["a.ts", "b.ts", "m/a.ts", "m/b/c.ts", "m/y.ts", "z.ts"]);
  });

  it("directories named like text files are walked, symlinks are not followed or read", () => {
    const d = tmp();
    put(d, "docs.md/inner.md", "in");
    put(d, "real.ts", "r");
    symlinkSync(join(d, "real.ts"), join(d, "link.ts"));
    symlinkSync(join(d, "docs.md"), join(d, "linkdir"));
    expect(paths(readProject(d, "tree"))).toEqual(["docs.md/inner.md", "real.ts"]);
  });
});

describe("applyWrites", () => {
  const w = (path: string, content: string | null, readonly = false) => ({ path, content, readonly });

  it("creates files and parent directories with mode 0644, readonly ones with 0444", () => {
    const d = tmp();
    applyWrites(d, [w("a/b/c.ts", "C"), w("r.ts", "R", true)]);
    expect(readFileSync(join(d, "a/b/c.ts"), "utf8")).toBe("C");
    expect(mode(join(d, "a/b/c.ts"))).toBe(0o644);
    expect(mode(join(d, "r.ts"))).toBe(0o444);
    expect(readFileSync(join(d, "r.ts"), "utf8")).toBe("R");
  });

  it("an existing file keeps its mode; a readonly one is rewritten and restored; readonly forces 0444", () => {
    const d = tmp();
    put(d, "x.sh", "old");
    chmodSync(join(d, "x.sh"), 0o755);
    applyWrites(d, [w("x.sh", "new")]);
    expect(readFileSync(join(d, "x.sh"), "utf8")).toBe("new");
    expect(mode(join(d, "x.sh"))).toBe(0o755);

    put(d, "ro.ts", "old");
    chmodSync(join(d, "ro.ts"), 0o444);
    applyWrites(d, [w("ro.ts", "fresh", true)]);
    expect(readFileSync(join(d, "ro.ts"), "utf8")).toBe("fresh");
    expect(mode(join(d, "ro.ts"))).toBe(0o444);

    applyWrites(d, [w("ro.ts", "again")]);
    expect(readFileSync(join(d, "ro.ts"), "utf8")).toBe("again");
    expect(mode(join(d, "ro.ts"))).toBe(0o444);

    applyWrites(d, [w("x.sh", "ro now", true)]);
    expect(mode(join(d, "x.sh"))).toBe(0o444);
  });

  it("null content removes an existing file and ignores a missing one without creating anything", () => {
    const d = tmp();
    put(d, "gone.ts", "x");
    chmodSync(join(d, "gone.ts"), 0o444);
    applyWrites(d, [w("gone.ts", null), w("never/was.ts", null)]);
    expect(existsSync(join(d, "gone.ts"))).toBe(false);
    expect(existsSync(join(d, "never"))).toBe(false);
  });

  it("rejects the whole set when any path is outside, the root itself, or absolute elsewhere; nothing is written", () => {
    const d = tmp();
    const other = tmp();
    for (const bad of ["../escape.ts", "a/../../escape.ts", ".", "", other, join(other, "abs.ts")]) {
      expect(() => applyWrites(d, [w("first.ts", "1"), w(bad, "x")])).toThrow(`refusing to write outside ${d}: ${bad}`);
      expect(existsSync(join(d, "first.ts"))).toBe(false);
    }
    expect(existsSync(join(other, "abs.ts"))).toBe(false);
  });

  it("accepts names that merely start with dots and absolute paths inside the root", () => {
    const d = tmp();
    applyWrites(d, [w("..hidden.ts", "1"), w(join(d, "inside.ts"), "2"), w("a/./b.ts", "3")]);
    expect(readFileSync(join(d, "..hidden.ts"), "utf8")).toBe("1");
    expect(readFileSync(join(d, "inside.ts"), "utf8")).toBe("2");
    expect(readFileSync(join(d, "a/b.ts"), "utf8")).toBe("3");
  });
});

describe("hostIo", () => {
  // process.chdir is unavailable in vitest worker threads (Stryker); hostIo reads process.cwd(), so spy on it.
  const inDir = <T>(d: string, f: () => T): T => {
    const spy = vi.spyOn(process, "cwd").mockReturnValue(d);
    try {
      return f();
    } finally {
      spy.mockRestore();
    }
  };

  it("reports cwd, string-only env, and loads files per scope; apply writes under cwd", () => {
    const d = tmp();
    put(d, "src/a.ts", "A");
    put(d, "notes.txt", "N");
    vi.stubEnv("KEEL_MUT_IO_PROBE", "probe-value");
    inDir(d, () => {
      const io = hostIo(false);
      expect(io.cwd).toBe(d);
      expect(io.env?.KEEL_MUT_IO_PROBE).toBe("probe-value");
      expect(Object.values(io.env ?? {}).every((v) => typeof v === "string")).toBe(true);
      expect(Object.keys(io.env ?? {}).length).toBeGreaterThan(1);
      expect(io.load?.("none")).toEqual([]);
      expect(io.load?.("query")).toEqual([{ path: "src/a.ts", source: "A" }]);
      expect(io.load?.("tree")).toEqual([
        { path: "notes.txt", source: "N" },
        { path: "src/a.ts", source: "A" },
      ]);
      io.apply?.([{ path: "out/new.ts", content: "NEW", readonly: false }]);
    });
    expect(readFileSync(join(d, "out/new.ts"), "utf8")).toBe("NEW");
  });

  it("no streams unless asked; tty follows stdout.isTTY exactly", () => {
    const d = tmp();
    const original = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    try {
      inDir(d, () => {
        for (const [value, expected] of [
          [true, true],
          [false, false],
          [undefined, false],
        ] as const) {
          Object.defineProperty(process.stdout, "isTTY", { value, configurable: true, writable: true });
          const io = hostIo(false);
          expect(io.tty).toBe(expected);
          expect("stdin" in io).toBe(false);
          expect("emit" in io).toBe(false);
        }
      });
    } finally {
      if (original === undefined) Reflect.deleteProperty(process.stdout, "isTTY");
      else Object.defineProperty(process.stdout, "isTTY", original);
    }
  });

  it("stream mode wires process stdin and an emit that writes to stdout and returns nothing", () => {
    const d = tmp();
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    inDir(d, () => {
      const io = hostIo(true);
      expect(io.stdin).toBe(process.stdin);
      expect(io.emit?.("hello")).toBeUndefined();
    });
    expect(spy).toHaveBeenCalledWith("hello");
  });

  it("fetch delegates to the global fetch with the url", async () => {
    const d = tmp();
    const calls: unknown[] = [];
    const res = new Response("body");
    vi.stubGlobal("fetch", (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(res);
    });
    const got = await inDir(d, () => hostIo(false).fetch?.("http://example.invalid/x"));
    expect(got).toBe(res);
    expect(calls).toEqual([["http://example.invalid/x"]]);
  });
});

describe("viteRun", () => {
  // npx under pnpm warns on stderr about inherited npm_config_* variables; that noise is not what is under test.
  const saved: [string, string | undefined][] = [];
  beforeEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k.toLowerCase().startsWith("npm_config_")) {
        saved.push([k, process.env[k]]);
        Reflect.deleteProperty(process.env, k);
      }
    }
  });
  afterEach(() => {
    for (const [k, v] of saved.splice(0)) if (v !== undefined) process.env[k] = v;
  });
  const fakeVite = (d: string, body: string): void => {
    put(d, "vite.config.ts", "export default {}\n");
    put(d, "node_modules/.bin/vite", `#!/bin/sh\n${body}\n`);
    chmodSync(join(d, "node_modules/.bin/vite"), 0o755);
  };

  it("is undefined without vite.config.ts, in both modes", () => {
    const d = tmp();
    expect(viteRun(d, "build")).toBeUndefined();
    expect(viteRun(d, "dev")).toBeUndefined();
  });

  it("build runs `vite build` in cwd; success is silent", () => {
    const d = tmp();
    fakeVite(d, 'echo "$@" > args.txt\npwd > cwd.txt\necho noisy\necho noisy-err >&2');
    expect(viteRun(d, "build")).toEqual({ code: 0, tail: "" });
    expect(readFileSync(join(d, "args.txt"), "utf8")).toBe("build\n");
    expect(realpathSync(readFileSync(join(d, "cwd.txt"), "utf8").trim())).toBe(d);
  });

  it("build with a deployable sets KEEL_DEPLOYABLE for that run only", () => {
    const d = tmp();
    fakeVite(d, 'echo "${KEEL_DEPLOYABLE-unset}" >> env.txt');
    expect(viteRun(d, "build", "api")).toEqual({ code: 0, tail: "" });
    expect(viteRun(d, "build")).toEqual({ code: 0, tail: "" });
    expect(readFileSync(join(d, "env.txt"), "utf8")).toBe(`api\n${process.env.KEEL_DEPLOYABLE ?? "unset"}\n`);
  });

  it("dev runs plain `vite`, hands over the terminal and returns its code with no tail", () => {
    const d = tmp();
    fakeVite(d, 'echo "args=$#" > args.txt\nexit 4');
    expect(viteRun(d, "dev")).toEqual({ code: 4, tail: "" });
    expect(readFileSync(join(d, "args.txt"), "utf8")).toBe("args=0\n");
  });

  it("build failure returns the last five lines of stderr, trimmed, with a trailing newline", () => {
    const d = tmp();
    fakeVite(d, 'echo out-ignored\nfor i in 1 2 3 4 5 6 7; do echo "err$i" >&2; done\necho >&2\nexit 2');
    expect(viteRun(d, "build")).toEqual({ code: 2, tail: "err3\nerr4\nerr5\nerr6\nerr7\n" });
  });

  it("build failure falls back to stdout when stderr is empty, and to a bare newline when both are", () => {
    const d = tmp();
    fakeVite(d, 'echo "  only stdout  "\nexit 1');
    expect(viteRun(d, "build")).toEqual({ code: 1, tail: "only stdout\n" });
    fakeVite(d, "exit 9");
    expect(viteRun(d, "build")).toEqual({ code: 9, tail: "\n" });
  });

  it("build failure keeps fewer than five lines whole", () => {
    const d = tmp();
    fakeVite(d, 'printf "a\\nb\\n" >&2\nexit 1');
    expect(viteRun(d, "build")).toEqual({ code: 1, tail: "a\nb\n" });
  });

  it("a vite killed by a signal has no status and counts as code 1", () => {
    const d = tmp();
    fakeVite(d, "kill -9 $$");
    expect(viteRun(d, "build")).toEqual({ code: 1, tail: "\n" });
  });
});
