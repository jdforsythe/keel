// The output of `keel-session-action` (docs/OUTPUT.md): its common flags, its text in compact, pretty and json mode,
// and the one-line cleaning every field goes through.
// Seed 1337
import type { OutRecord } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { OutputFlags } from "../src/internal/OutputFlags.ts";
import { actionFlags } from "../src/internal/actionFlags.ts";
import { actionText } from "../src/internal/actionText.ts";
import { clean } from "../src/internal/clean.ts";

const compact: OutputFlags = { mode: "compact", quiet: false, limit: undefined };
const pretty: OutputFlags = { mode: "pretty", quiet: false, limit: undefined };
const json: OutputFlags = { mode: "json", quiet: false, limit: undefined };
const session = (over: Record<string, unknown> = {}): OutRecord => ({
  kind: "session",
  id: "s1",
  fingerprint: "7f3a9c01d2e4",
  route: "cart.show",
  events: 4,
  inputs: 2,
  error: "cart.full",
  file: "sessions/a.json",
  ...over,
});
const diag = (code: string, over: Record<string, unknown> = {}): OutRecord => ({
  kind: "diag",
  code,
  message: `${code} happened`,
  ...over,
});
const summary = (ok: boolean, counts: unknown = { sessions: 2 }): OutRecord => ({
  kind: "summary",
  ok,
  name: "session action",
  counts,
});

describe("actionFlags", () => {
  const flags = (args: string[], env: Record<string, string> = {}, tty = false) => actionFlags(args, env, tty);

  test("the default mode is compact off a TTY or with KEEL_AGENT=1, else pretty", () => {
    expect(flags([], {}, false)).toEqual({ ok: true, value: compact });
    expect(flags([], {}, true)).toEqual({ ok: true, value: pretty });
    expect(flags([], { KEEL_AGENT: "1" }, true)).toEqual({ ok: true, value: compact });
    expect(flags([], { KEEL_AGENT: "0" }, true)).toEqual({ ok: true, value: pretty });
    expect(flags([], { KEEL_AGENT: "" }, true)).toEqual({ ok: true, value: pretty });
  });

  test("--format names the mode, the last one winning; --quiet and --limit set theirs", () => {
    expect(flags(["--format=json"], {}, true)).toEqual({ ok: true, value: json });
    expect(flags(["--format=pretty"])).toEqual({ ok: true, value: pretty });
    expect(flags(["--format=compact"], {}, true)).toEqual({ ok: true, value: compact });
    expect(flags(["--format=json", "--format=pretty"])).toEqual({ ok: true, value: pretty });
    expect(flags(["--quiet"])).toEqual({ ok: true, value: { ...compact, quiet: true } });
    expect(flags(["--limit", "3"])).toEqual({ ok: true, value: { ...compact, limit: 3 } });
    expect(flags(["--limit=12"])).toEqual({ ok: true, value: { ...compact, limit: 12 } });
    expect(flags(["--limit", "0", "--quiet", "--format=json"])).toEqual({
      ok: true,
      value: { mode: "json", quiet: true, limit: 0 },
    });
    expect(flags(["--limit=999999"])).toEqual({ ok: true, value: { ...compact, limit: 999999 } });
  });

  test("--limit takes the next argument, which is then not read as a flag", () => {
    expect(flags(["--limit", "5", "--quiet"])).toEqual({ ok: true, value: { ...compact, quiet: true, limit: 5 } });
    expect(flags(["--limit", "--quiet"])).toEqual({ ok: false, why: "--limit needs a whole number" });
  });

  test("a --limit that is missing or no whole number of 1 to 6 digits is refused", () => {
    for (const args of [
      ["--limit"],
      ["--limit="],
      ["--limit", ""],
      ["--limit", "x"],
      ["--limit", "1x"],
      ["--limit", "x1"],
      ["--limit", "-1"],
      ["--limit", "1.5"],
      ["--limit=1234567"],
      ["--limit=12 "],
    ])
      expect(flags(args), args.join(" ")).toEqual({ ok: false, why: "--limit needs a whole number" });
  });

  test("anything else is an unknown flag, named by its first 30 characters", () => {
    expect(flags(["--verbose"])).toEqual({ ok: false, why: "unknown flag --verbose" });
    expect(flags(["--format=xml"])).toEqual({ ok: false, why: "unknown flag --format=xml" });
    expect(flags(["x--format=json"])).toEqual({ ok: false, why: "unknown flag x--format=json" });
    expect(flags(["--format=jsonx"])).toEqual({ ok: false, why: "unknown flag --format=jsonx" });
    expect(flags(["x--limit=3"])).toEqual({ ok: false, why: "unknown flag x--limit=3" });
    expect(flags(["--quiet=1"])).toEqual({ ok: false, why: "unknown flag --quiet=1" });
    expect(flags([""])).toEqual({ ok: false, why: "unknown flag " });
    expect(flags([`--${"x".repeat(40)}`])).toEqual({ ok: false, why: `unknown flag --${"x".repeat(28)}` });
    expect(flags(["--quiet", "nope", "--format=json"])).toEqual({ ok: false, why: "unknown flag nope" });
  });
});

describe("clean", () => {
  test("ANSI escapes go, every other control character is a space", () => {
    expect(clean("\u001b[31mred\u001b[0m")).toBe("red");
    expect(clean("\u001b]8;;http://x.test\u0007link\u001b]8;;\u0007")).toBe("link");
    expect(clean("a\nb\tc\rd\u0000e\u007ff\u0085g")).toBe("a b c d e f g");
    expect(clean("plain text, 100%")).toBe("plain text, 100%");
  });

  test("a text of `max` characters is whole; a longer one is cut to `max` with '...'", () => {
    expect(clean("x".repeat(200))).toBe("x".repeat(200));
    expect(clean("x".repeat(201))).toBe(`${"x".repeat(197)}...`);
    expect(clean("abcdef", 6)).toBe("abcdef");
    expect(clean("abcdefg", 6)).toBe("abc...");
  });

  test("property: the result is one line of at most `max` characters", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), fc.integer({ min: 3, max: 300 }), (text, max) => {
        const out = clean(text, max);
        expect(out.length).toBeLessThanOrEqual(max);
        // biome-ignore lint/suspicious/noControlCharactersInRegex: the class names the control characters `clean` removes.
        expect(/[\u0000-\u001f\u007f-\u009f]/.test(out)).toBe(false);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("actionText: one record", () => {
  test("a session: compact is the session line, pretty names events, inputs and the error or ok", () => {
    expect(actionText([session()], compact)).toBe("7f3a9c01d2e4 cart.show 4 events cart.full -> sessions/a.json\n");
    expect(actionText([session({ error: null, file: null })], compact)).toBe("7f3a9c01d2e4 cart.show 4 events ok\n");
    expect(actionText([session()], pretty)).toBe("session 7f3a9c01d2e4 cart.show: 4 events, 2 inputs, cart.full\n");
    expect(actionText([session({ error: null })], pretty)).toBe(
      "session 7f3a9c01d2e4 cart.show: 4 events, 2 inputs, ok\n",
    );
  });

  test("a session's strings are cleaned to one line; one that is no session record prints nothing", () => {
    expect(
      actionText(
        [session({ fingerprint: "7f\n3a", route: "cart\u001b[31m.show", error: "cart\n.full", file: "a\n.json" })],
        compact,
      ),
    ).toBe("7f 3a cart.show 4 events cart .full -> a .json\n");
    expect(actionText([session({ events: "many" })], compact)).toBe("");
    expect(actionText([session({ events: "many" }), summary(true)], compact)).toBe("ok session action 2 sessions\n");
    expect(actionText([session({ extra: 1 })], pretty)).toBe("");
  });

  test("a diag: `CODE path:line:col message`, then the fix hunk without its file header, then see", () => {
    expect(actionText([diag("E2004")], compact)).toBe("E2004 E2004 happened\n");
    expect(actionText([diag("E2004", { path: "sessions/a.json" })], compact)).toBe(
      "E2004 sessions/a.json:1:1 E2004 happened\n",
    );
    expect(actionText([diag("E2004", { path: "a.json", line: 3, col: 9 })], pretty)).toBe(
      "E2004 a.json:3:9 E2004 happened\n",
    );
    expect(actionText([diag("E2004", { path: 5, line: 3, col: 9 })], compact)).toBe("E2004 E2004 happened\n");
    expect(
      actionText(
        [
          diag("E1052", {
            fix: "--- a/vitest.config.ts\n+++ b/vitest.config.ts\n-  old\n+  new\n+++more",
            see: "k.cli",
          }),
        ],
        compact,
      ),
    ).toBe("E1052 E1052 happened\n  fix: -  old\n       +  new\n       +++more\n  see: k.cli\n");
    expect(actionText([diag("E1052", { fix: "x --- y", see: 5 })], compact)).toBe(
      "E1052 E1052 happened\n  fix: x --- y\n",
    );
    expect(actionText([diag("E1052", { fix: 5 })], compact)).toBe("E1052 E1052 happened\n");
  });

  test("a diag's fields are cleaned; a field that is no string or number prints empty", () => {
    expect(actionText([diag("E2004", { message: "two\nlines", path: "a\tb.json" })], compact)).toBe(
      "E2004 a b.json:1:1 two lines\n",
    );
    expect(actionText([{ kind: "diag", code: 2004, message: { text: "no" } }], compact)).toBe("2004 \n");
    expect(actionText([{ kind: "diag", code: true, message: "m" }], compact)).toBe(" m\n");
  });

  test("a session.issue: fingerprint, action and the issue number when it is one", () => {
    const issue = { kind: "session.issue", fingerprint: "7f3a9c01d2e4", action: "opened", issue: 12 };
    expect(actionText([issue], compact)).toBe("7f3a9c01d2e4 opened #12\n");
    expect(actionText([issue], pretty)).toBe("session 7f3a9c01d2e4: opened issue #12\n");
    expect(actionText([{ ...issue, issue: "12" }], compact)).toBe("7f3a9c01d2e4 opened\n");
    expect(actionText([{ ...issue, issue: undefined }], pretty)).toBe("session 7f3a9c01d2e4: opened issue\n");
  });

  test("a summary: `ok|fail name counts` compact, `name: passed|failed (counts)` pretty", () => {
    expect(actionText([summary(true)], compact)).toBe("ok session action 2 sessions\n");
    expect(actionText([summary(false, { sessions: 2, issues: 1 })], compact)).toBe(
      "fail session action 2 sessions, 1 issues\n",
    );
    expect(actionText([summary(true, {})], compact)).toBe("ok session action\n");
    expect(actionText([summary(true, null)], compact)).toBe("ok session action\n");
    expect(actionText([summary(true, "counts")], compact)).toBe("ok session action\n");
    expect(actionText([{ kind: "summary", ok: "yes", name: "n" }], compact)).toBe("fail n\n");
    expect(actionText([summary(true)], pretty)).toBe("session action: passed (2 sessions)\n");
    expect(actionText([summary(false, {})], pretty)).toBe("session action: failed\n");
    expect(actionText([{ kind: "summary", ok: 1, name: "n" }], pretty)).toBe("n: failed\n");
  });

  test("a record of another kind prints nothing in compact and pretty, and itself in json", () => {
    const other = { kind: "note", text: "hello" };
    expect(actionText([other], compact)).toBe("");
    expect(actionText([other], pretty)).toBe("");
    expect(actionText([other], json)).toBe(`${JSON.stringify(other)}\n`);
    expect(actionText([], compact)).toBe("");
    expect(actionText([], json)).toBe("");
  });
});

describe("actionText: groups, caps and the summary", () => {
  test("records are grouped by kind, diags by code, in order of first appearance; the last summary ends it", () => {
    const records = [
      summary(false, { sessions: 9 }),
      diag("E2004", { message: "first" }),
      session({ fingerprint: "aaaaaaaaaaaa", file: null }),
      diag("E2003", { message: "second" }),
      diag("E2004", { message: "third" }),
      session({ fingerprint: "bbbbbbbbbbbb", file: null }),
      summary(true),
    ];
    expect(actionText(records, compact)).toBe(
      [
        "E2004 first",
        "E2004 third",
        "aaaaaaaaaaaa cart.show 4 events cart.full",
        "bbbbbbbbbbbb cart.show 4 events cart.full",
        "E2003 second",
        "ok session action 2 sessions",
        "",
      ].join("\n"),
    );
  });

  test("a kind that merely ends in or contains 'diag:' is no diagnostic group", () => {
    const records = Array.from({ length: 7 }, (_, i) => ({ kind: "session.issue", fingerprint: `f${i}`, action: "x" }));
    expect(actionText(records, compact).split("\n")).toHaveLength(8);
    const odd = Array.from({ length: 7 }, () => ({ kind: "note diag:" }));
    expect(actionText(odd, json).trimEnd().split("\n")).toHaveLength(7);
    expect(actionText(odd, compact)).toBe("");
  });

  test("compact and pretty show 5 of a diagnostic code, then how many more and the flag that shows them", () => {
    const seven = Array.from({ length: 7 }, (_, i) => diag("E2004", { message: `m${i}` }));
    const five = seven.slice(0, 5);
    expect(actionText(seven, compact)).toBe(
      `${five.map((d) => `E2004 ${String(d.message)}`).join("\n")}\n... +2 more E2004 (keel-session-action --limit 7)\n`,
    );
    expect(actionText(seven, pretty)).toContain("... +2 more E2004 (keel-session-action --limit 7)");
    expect(actionText(five, compact)).toBe(`${five.map((d) => `E2004 ${String(d.message)}`).join("\n")}\n`);
    expect(actionText(seven.slice(0, 6), compact)).toContain("... +1 more E2004 (keel-session-action --limit 6)");
  });

  test("other kinds are capped only under --limit, and the line names the kind", () => {
    const seven = Array.from({ length: 7 }, (_, i) => session({ fingerprint: `f${i}`, file: null, error: null }));
    expect(actionText(seven, compact).trimEnd().split("\n")).toHaveLength(7);
    expect(actionText(seven, { ...compact, limit: 2 })).toBe(
      "f0 cart.show 4 events ok\nf1 cart.show 4 events ok\n... +5 more session (keel-session-action --limit 7)\n",
    );
    expect(
      actionText(seven, { ...compact, limit: 7 })
        .trimEnd()
        .split("\n"),
    ).toHaveLength(7);
    expect(actionText(seven, { ...compact, limit: 0 })).toBe("... +7 more session (keel-session-action --limit 7)\n");
  });

  test("--limit raises the diagnostic cap too", () => {
    const seven = Array.from({ length: 7 }, (_, i) => diag("E2004", { message: `m${i}` }));
    expect(
      actionText(seven, { ...compact, limit: 6 })
        .trimEnd()
        .split("\n"),
    ).toEqual([
      "E2004 m0",
      "E2004 m1",
      "E2004 m2",
      "E2004 m3",
      "E2004 m4",
      "E2004 m5",
      "... +1 more E2004 (keel-session-action --limit 7)",
    ]);
  });

  test("json is one record per line, every diagnostic kept, cut only under --limit and with no 'more' line", () => {
    const seven = Array.from({ length: 7 }, (_, i) => diag("E2004", { message: `m${i}` }));
    const all = [...seven, summary(true)];
    expect(actionText(all, json)).toBe(`${all.map((r) => JSON.stringify(r)).join("\n")}\n`);
    expect(actionText(all, { ...json, limit: 2 })).toBe(
      `${[seven[0], seven[1], summary(true)].map((r) => JSON.stringify(r)).join("\n")}\n`,
    );
  });

  test("--quiet keeps the summary alone, in every mode", () => {
    const records = [diag("E2004"), session(), summary(false)];
    expect(actionText(records, { ...compact, quiet: true })).toBe("fail session action 2 sessions\n");
    expect(actionText(records, { ...pretty, quiet: true })).toBe("session action: failed (2 sessions)\n");
    expect(actionText(records, { ...json, quiet: true })).toBe(`${JSON.stringify(summary(false))}\n`);
    expect(actionText([diag("E2004")], { ...compact, quiet: true })).toBe("");
  });

  test("property: compact text ends in a newline, has no blank line, and its last line is the summary", () => {
    const record = fc.oneof(
      fc.constantFrom("E2002", "E2003", "E2004").map((code) => diag(code)),
      fc.stringMatching(/^[0-9a-f]{12}$/).map((fingerprint) => session({ fingerprint })),
    );
    fc.assert(
      fc.property(fc.array(record, { maxLength: 20 }), fc.boolean(), (records, ok) => {
        const text = actionText([...records, summary(ok)], compact);
        expect(text.endsWith("\n")).toBe(true);
        const lines = text.slice(0, -1).split("\n");
        expect(lines.every((l) => l !== "")).toBe(true);
        expect(lines.at(-1)).toBe(`${ok ? "ok" : "fail"} session action 2 sessions`);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
