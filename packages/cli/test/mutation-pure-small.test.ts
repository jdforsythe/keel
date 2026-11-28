// Exact-output tests for the small pure helpers under src/internal (mutation killers).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/internal/canonicalJson.ts";
import { defaultMode } from "../src/internal/defaultMode.ts";
import { diagCompact } from "../src/internal/diagCompact.ts";
import { diagPretty } from "../src/internal/diagPretty.ts";
import { errorText } from "../src/internal/errorText.ts";
import { exitCode } from "../src/internal/exitCode.ts";
import { isRecord } from "../src/internal/isRecord.ts";
import { makeDiag } from "../src/internal/makeDiag.ts";
import { normalize } from "../src/internal/normalize.ts";
import { rpcFailure } from "../src/internal/rpcFailure.ts";
import { rpcReply } from "../src/internal/rpcReply.ts";
import { unavailable } from "../src/internal/unavailable.ts";
import { uriPath } from "../src/internal/uriPath.ts";
import { usageResult } from "../src/internal/usageResult.ts";
import { where } from "../src/internal/where.ts";

const SEED = 1337;

describe("where", () => {
  it("path:line:col, path, or empty", () => {
    expect(where({})).toBe("");
    expect(where({ line: 3, col: 4 })).toBe("");
    expect(where({ path: "a.ts" })).toBe("a.ts");
    expect(where({ path: "a.ts", col: 4 })).toBe("a.ts");
    expect(where({ path: "a.ts", line: 3 })).toBe("a.ts:3:1");
    expect(where({ path: "a.ts", line: 3, col: 4 })).toBe("a.ts:3:4");
    expect(where({ path: "a.ts", line: 3, col: 0 })).toBe("a.ts:3:0");
  });
});

describe("makeDiag", () => {
  it("keeps absent optional fields absent, in a fixed key order", () => {
    expect(makeDiag("E1000", "m")).toStrictEqual({ kind: "diag", code: "E1000", message: "m" });
    expect(Object.keys(makeDiag("E1000", "m", { path: "p", line: 1, col: 2, fix: "f", see: "s" }))).toEqual([
      "kind",
      "code",
      "path",
      "line",
      "col",
      "message",
      "fix",
      "see",
    ]);
    expect(makeDiag("E1000", "m", { path: "p" })).toStrictEqual({
      kind: "diag",
      code: "E1000",
      path: "p",
      message: "m",
    });
    expect(makeDiag("E1000", "m", { line: 0 })).toStrictEqual({ kind: "diag", code: "E1000", line: 0, message: "m" });
    expect(makeDiag("E1000", "m", { col: 0 })).toStrictEqual({ kind: "diag", code: "E1000", col: 0, message: "m" });
    expect(makeDiag("E1000", "m", { fix: "" })).toStrictEqual({ kind: "diag", code: "E1000", message: "m", fix: "" });
    expect(makeDiag("E1000", "m", { see: "" })).toStrictEqual({ kind: "diag", code: "E1000", message: "m", see: "" });
    expect(makeDiag("E1000", "m", { path: undefined, see: undefined })).toStrictEqual(makeDiag("E1000", "m"));
  });

  it("messages longer than 89 chars are cut to 86 plus an ellipsis", () => {
    const at89 = "a".repeat(89);
    expect(makeDiag("E1000", at89).message).toBe(at89);
    expect(makeDiag("E1000", "a".repeat(90)).message).toBe(`${"a".repeat(86)}...`);
    expect(makeDiag("E1000", "ab".repeat(100)).message).toBe(`${"ab".repeat(43)}...`);
  });
});

describe("diagCompact", () => {
  it("head, fix lines, see", () => {
    expect(diagCompact(makeDiag("E1000", "msg"))).toBe("E1000 msg");
    expect(diagCompact(makeDiag("E1000", "msg", { path: "a.ts" }))).toBe("E1000 a.ts msg");
    expect(diagCompact(makeDiag("E1000", "msg", { path: "a.ts", line: 3 }))).toBe("E1000 a.ts:3:1 msg");
    expect(diagCompact(makeDiag("E1000", "msg", { path: "a.ts", line: 3, col: 4 }))).toBe("E1000 a.ts:3:4 msg");
    expect(diagCompact(makeDiag("E1000", "msg", { see: "k.x" }))).toBe("E1000 msg\n  see: keel docs k.x");
    expect(diagCompact(makeDiag("E1000", "msg", { fix: "one" }))).toBe("E1000 msg\n  fix: one");
    expect(diagCompact(makeDiag("E1000", "msg", { fix: "one\ntwo\nthree", see: "k.x" }))).toBe(
      "E1000 msg\n  fix: one\n       two\n       three\n  see: keel docs k.x",
    );
    expect(diagCompact(makeDiag("E1000", "msg", { fix: "" }))).toBe("E1000 msg\n  fix: ");
  });
});

describe("diagPretty", () => {
  it("location line, indented message, fix and see", () => {
    expect(diagPretty(makeDiag("E1000", "msg"))).toBe("E1000\n  msg");
    expect(diagPretty(makeDiag("E1000", "msg", { path: "a.ts" }))).toBe("E1000  a.ts\n  msg");
    expect(diagPretty(makeDiag("E1000", "msg", { path: "a.ts", line: 3, col: 4 }))).toBe("E1000  a.ts:3:4\n  msg");
    expect(diagPretty(makeDiag("E1000", "msg", { see: "k.x" }))).toBe("E1000\n  msg\n  see: keel docs k.x");
    expect(diagPretty(makeDiag("E1000", "msg", { fix: "one" }))).toBe("E1000\n  msg\n  fix:\n    one");
    expect(diagPretty(makeDiag("E1000", "msg", { fix: "one\ntwo", see: "k.x" }))).toBe(
      "E1000\n  msg\n  fix:\n    one\n    two\n  see: keel docs k.x",
    );
    expect(diagPretty(makeDiag("E1000", "msg", { fix: "" }))).toBe("E1000\n  msg\n  fix:\n    ");
  });
});

describe("canonicalJson", () => {
  it("sorts keys at every depth, keeps array order", () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: [{ z: 1, y: 2 }, 3] } })).toBe(
      '{"a":{"c":[{"y":2,"z":1},3],"d":1},"b":1}',
    );
    expect(canonicalJson([{ b: 1, a: 2 }, null, "x", 1])).toBe('[{"a":2,"b":1},null,"x",1]');
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("s")).toBe('"s"');
    expect(canonicalJson(5)).toBe("5");
    expect(canonicalJson({})).toBe("{}");
    expect(canonicalJson({ a: null })).toBe('{"a":null}');
    expect(canonicalJson({ b: [], a: {} })).toBe('{"a":{},"b":[]}');
  });

  it("property: parse(canonicalJson(x)) equals x, and key order is irrelevant", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.stringMatching(/^[a-z0-9]{1,4}$/), fc.integer()), (d) => {
        const rev = Object.fromEntries(Object.entries(d).reverse());
        expect(canonicalJson(d)).toBe(canonicalJson(rev));
        expect(JSON.parse(canonicalJson(d))).toEqual(d);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

describe("errorText", () => {
  it("first line of the message, at most 200 chars", () => {
    expect(errorText(new Error("boom\nstack"))).toBe("boom");
    expect(errorText(new Error("only"))).toBe("only");
    expect(errorText(new Error(""))).toBe("");
    expect(errorText(new Error("\nafter"))).toBe("");
    expect(errorText("plain\nsecond")).toBe("plain");
    expect(errorText(42)).toBe("42");
    expect(errorText(null)).toBe("null");
    expect(errorText({})).toBe("[object Object]");
    expect(errorText("x".repeat(200))).toBe("x".repeat(200));
    expect(errorText("x".repeat(201))).toBe("x".repeat(200));
    expect(errorText(new Error("y".repeat(500)))).toBe("y".repeat(200));
  });
});

describe("defaultMode", () => {
  it("pretty only on a TTY without KEEL_AGENT=1", () => {
    expect(defaultMode({ cwd: "/" })).toBe("compact");
    expect(defaultMode({ cwd: "/", tty: false })).toBe("compact");
    expect(defaultMode({ cwd: "/", tty: true })).toBe("pretty");
    expect(defaultMode({ cwd: "/", tty: true, env: {} })).toBe("pretty");
    expect(defaultMode({ cwd: "/", tty: true, env: { KEEL_AGENT: "1" } })).toBe("compact");
    expect(defaultMode({ cwd: "/", tty: true, env: { KEEL_AGENT: "0" } })).toBe("pretty");
    expect(defaultMode({ cwd: "/", tty: true, env: { KEEL_AGENT: "" } })).toBe("pretty");
    expect(defaultMode({ cwd: "/", tty: false, env: { KEEL_AGENT: "0" } })).toBe("compact");
  });
});

describe("normalize", () => {
  it("unknown kinds and malformed records become E1054; valid ones pass untouched", () => {
    const good = makeDiag("E1000", "m");
    const sum = { kind: "summary", ok: true, name: "x", counts: {} };
    const out = normalize([good, { kind: "nope" }, { kind: "diag", code: "x" }, sum]);
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(good);
    expect(out[1]).toStrictEqual({ kind: "diag", code: "E1054", message: "record kind nope has no formatter" });
    expect(out[2]).toStrictEqual({
      kind: "diag",
      code: "E1054",
      message: "record of kind diag does not fit its formatter schema",
    });
    expect(out[3]).toBe(sum);
    expect(normalize([])).toEqual([]);
  });
});

describe("exitCode", () => {
  const d = (code: unknown, kind = "diag") => ({ kind, code });
  it("2 for usage errors, 1 for other errors or failing summaries, else 0", () => {
    expect(exitCode([])).toBe(0);
    expect(exitCode([d("E1051")])).toBe(2);
    expect(exitCode([d("E1052")])).toBe(2);
    expect(exitCode([d("E1000")])).toBe(1);
    expect(exitCode([d("W1000")])).toBe(0);
    expect(exitCode([d("I1055")])).toBe(0);
    expect(exitCode([d("T0001")])).toBe(0);
    expect(exitCode([d("XE1052")])).toBe(0);
    expect(exitCode([d(5)])).toBe(0);
    expect(exitCode([d("E1051", "other")])).toBe(0);
    expect(exitCode([d("E1000", "other")])).toBe(0);
    expect(exitCode([{ kind: "summary", ok: false }])).toBe(1);
    expect(exitCode([{ kind: "summary", ok: true }])).toBe(0);
    expect(exitCode([{ kind: "summary" }])).toBe(0);
    expect(exitCode([{ kind: "other", ok: false }])).toBe(0);
    expect(exitCode([d("E1000"), d("E1052")])).toBe(2);
    expect(exitCode([d("E1052"), d("E1000")])).toBe(2);
    expect(exitCode([d("W1000"), { kind: "summary", ok: false }])).toBe(1);
  });
});

describe("isRecord", () => {
  it("plain objects only", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("s")).toBe(false);
    expect(isRecord(5)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(() => 1)).toBe(false);
  });
});

describe("rpcReply / rpcFailure", () => {
  it("result or error, never both", () => {
    expect(rpcReply(1, { a: 1 })).toStrictEqual({ jsonrpc: "2.0", id: 1, result: { a: 1 } });
    expect(rpcReply("x", undefined)).toStrictEqual({ jsonrpc: "2.0", id: "x", result: undefined });
    expect(Object.keys(rpcReply(1, 2))).toEqual(["jsonrpc", "id", "result"]);
    expect(rpcReply(null, undefined, { code: -1, message: "m" })).toStrictEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -1, message: "m" },
    });
    expect(Object.keys(rpcReply(0, 5, { code: 1, message: "m" }))).toEqual(["jsonrpc", "id", "error"]);
  });

  it("failures for unparsable and invalid messages only", () => {
    expect(rpcFailure({ kind: "unparsable" })).toStrictEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "parse error" },
    });
    expect(rpcFailure({ kind: "invalid", id: 7, message: "bad" })).toStrictEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32600, message: "bad" },
    });
    expect(rpcFailure({ kind: "invalid", id: null, message: "bad" })).toMatchObject({ id: null });
    expect(rpcFailure({ kind: "request", id: 1, method: "m", params: undefined })).toBeUndefined();
    expect(rpcFailure({ kind: "notification", method: "m", params: undefined })).toBeUndefined();
  });
});

describe("unavailable", () => {
  it("info I1055 and an ok summary", () => {
    expect(unavailable("inspect", "a network", "k.cli")).toStrictEqual([
      { kind: "diag", code: "I1055", message: "inspect not available: needs a network", see: "k.cli" },
      { kind: "summary", ok: true, name: "inspect", counts: {} },
    ]);
  });
});

describe("uriPath", () => {
  it("file URIs are decoded and made project relative", () => {
    expect(uriPath("/work/app", "file:///work/app/src/a.ts")).toBe("src/a.ts");
    expect(uriPath("/work/app/", "file:///work/app/src/a.ts")).toBe("src/a.ts");
    expect(uriPath("/work/app", "file:///work/app/a%20b.ts")).toBe("a b.ts");
    expect(uriPath("/work/app", "file:///work/app/a%zz.ts")).toBe("a%zz.ts");
    expect(uriPath("/work/app", "file:///work/other/a.ts")).toBe("../other/a.ts");
  });

  it("non-file URIs are used as they are (relative path semantics)", () => {
    expect(uriPath("/work/app", "/work/app/x.ts")).toBe("x.ts");
    expect(uriPath("/work/app", "./y.ts")).toBe("y.ts");
    expect(uriPath("/work/app", "z.ts")).toBe("z.ts");
    expect(uriPath("/work/app", "xfile:///work/app/a")).toBe("xfile:///work/app/a");
    expect(uriPath("/work/app", "file:/work/app/a")).toBe("file:/work/app/a");
  });
});

describe("usageResult", () => {
  it("diagnostics then a failing summary, exit 2, nothing on stderr", () => {
    const diags = [
      makeDiag("E1052", "unknown flag --x", { see: "k.cli" }),
      makeDiag("E1052", "second", { see: "k.cli" }),
    ];
    const r = usageResult("check", diags, { cwd: "/w" }, "compact");
    expect(r.code).toBe(2);
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe(
      "E1052 unknown flag --x\n  see: keel docs k.cli\nE1052 second\n  see: keel docs k.cli\nfail check 2 errors\n",
    );
    expect(r.records).toStrictEqual([...diags, { kind: "summary", ok: false, name: "check", counts: { errors: 2 } }]);
    const j = usageResult("check", [diags[0] ?? makeDiag("E1052", "")], { cwd: "/w", tty: true }, "json");
    expect(j.stdout.split("\n")[0]?.startsWith("{")).toBe(true);
    const pretty = usageResult("check", [], { cwd: "/w" }, "pretty");
    expect(pretty.code).toBe(0);
    expect(pretty.stdout).toBe("check: passed (0 errors)\n");
  });

  it("without a format the default mode applies", () => {
    const d = makeDiag("E1051", "no command given", { see: "k.cli" });
    expect(usageResult("keel", [d], { cwd: "/w" }, undefined).stdout).toBe(
      "E1051 no command given\n  see: keel docs k.cli\nfail keel 1 errors\n",
    );
    expect(usageResult("keel", [d], { cwd: "/w", tty: true }, undefined).stdout).toBe(
      "E1051\n  no command given\n  see: keel docs k.cli\nkeel: failed (1 errors)\n",
    );
  });
});
