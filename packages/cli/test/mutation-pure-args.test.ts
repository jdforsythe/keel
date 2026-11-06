// Exact-output tests for parseArgv, validateArgs, issueDiags (mutation killers).
import { describe, expect, it } from "vitest";
import { parseArgv } from "../src/internal/parseArgv.ts";
import { validateArgs } from "../src/internal/validateArgs.ts";
import { operations } from "../src/operations.ts";

const fails = (argv: string[]) => {
  const p = parseArgv(argv, operations);
  if (p.ok) throw new Error(`expected usage error for ${argv.join(" ")}`);
  return p;
};
const msgs = (argv: string[]): string[] => fails(argv).diags.map((d) => d.message);
const okParse = (argv: string[]) => {
  const p = parseArgv(argv, operations);
  if (!p.ok) throw new Error(`unexpected usage error: ${p.diags.map((d) => d.message).join("; ")}`);
  return { name: p.op.name, input: p.input };
};
const op = (name: string) => {
  const o = operations.find((x) => x.name === name);
  if (o === undefined) throw new Error(name);
  return o;
};

describe("parseArgv", () => {
  it("no command / flag first: E1051 under `keel`", () => {
    for (const argv of [[], ["--format=json"], ["-x"]]) {
      const p = fails(argv);
      expect(p.command).toBe("keel");
      expect(p.diags).toStrictEqual([
        { kind: "diag", code: "E1051", message: "no command given; see keel spec k.cli", see: "k.cli" },
      ]);
    }
    expect(fails(["--format=json"]).format).toBe("json");
    expect(fails([]).format).toBeUndefined();
  });

  it("unknown command: quoted, truncated at 24, E1051, format sniffed", () => {
    const p = fails(["nope", "--format=pretty"]);
    expect(p.command).toBe("nope");
    expect(p.format).toBe("pretty");
    expect(p.diags).toStrictEqual([{ kind: "diag", code: "E1051", message: 'unknown command "nope"', see: "k.cli" }]);
    expect(msgs(["x".repeat(30)])).toEqual([`unknown command "${"x".repeat(24)}"`]);
    expect(msgs([""])).toEqual(['unknown command ""']);
  });

  it("flag forms: --name value, --name=value, booleans, positional words", () => {
    expect(okParse(["check", "--limit", "3"])).toStrictEqual({ name: "check", input: { limit: 3 } });
    expect(okParse(["check", "--limit=3"])).toStrictEqual({ name: "check", input: { limit: 3 } });
    expect(okParse(["check", "--quiet"]).input).toStrictEqual({ quiet: true });
    expect(okParse(["check", "--quiet=false"]).input).toStrictEqual({ quiet: false });
    expect(okParse(["check", "--code=a=b"]).input).toStrictEqual({ code: "a=b" });
    expect(okParse(["check", "--code="]).input).toStrictEqual({});
    expect(okParse(["check", "--code", "E1000"]).input).toStrictEqual({ code: "E1000" });
    expect(okParse(["check", "--quiet", "a.ts"]).input).toStrictEqual({ quiet: true, paths: ["a.ts"] });
    expect(okParse(["check", "a.ts", "b.ts", "--limit=1", "c.ts"]).input).toStrictEqual({
      paths: ["a.ts", "b.ts", "c.ts"],
      limit: 1,
    });
    expect(okParse(["spec", "k.cli"]).input).toStrictEqual({ id: "k.cli" });
    expect(okParse(["check", "-"]).input).toStrictEqual({ paths: ["-"] });
  });

  it("scalar flags may not repeat", () => {
    expect(msgs(["check", "--limit=1", "--limit=2"])).toEqual(["flag --limit given twice"]);
    expect(msgs(["check", "--quiet", "--quiet"])).toEqual(["flag --quiet given twice"]);
  });

  it("scaffold: first word is op, the rest is args", () => {
    expect(okParse(["scaffold", "add", "x", "y"]).input).toStrictEqual({ op: "add", args: ["x", "y"] });
  });

  it("unknown flags: shown without value, clipped at 30; single dash and positional names are unknown", () => {
    expect(msgs(["check", "--bogus=1"])).toEqual(["unknown flag --bogus"]);
    expect(msgs(["check", "--bogus"])).toEqual(["unknown flag --bogus"]);
    expect(msgs(["check", "-x=1"])).toEqual(["unknown flag -x"]);
    expect(msgs(["check", "-x"])).toEqual(["unknown flag -x"]);
    expect(msgs(["check", "-limit=3"])).toEqual(["unknown flag -limit"]);
    expect(msgs(["check", "--paths=a"])).toEqual(["unknown flag --paths"]);
    expect(msgs(["spec", "--id=x"])).toEqual(["unknown flag --id"]);
    expect(msgs(["check", `--${"f".repeat(40)}`])).toEqual([`unknown flag --${"f".repeat(28)}`]);
    expect(fails(["check", "--bogus"]).command).toBe("check");
    expect(fails(["check", "--bogus"]).diags[0]).toStrictEqual({
      kind: "diag",
      code: "E1052",
      message: "unknown flag --bogus",
      see: "k.cli",
    });
  });

  it("missing flag value", () => {
    expect(msgs(["check", "--limit"])).toEqual(["flag --limit needs a value"]);
    expect(msgs(["check", "--limit", "--quiet"])).toEqual(["flag --limit needs a value"]);
    expect(msgs(["check", "--code", "--x"])).toEqual(["flag --code needs a value", "unknown flag --x"]);
  });

  it("a lone -- after a value flag is taken as the value", () => {
    expect(okParse(["check", "--code", "--"]).input).toStrictEqual({ code: "--" });
  });

  it("surplus bare words", () => {
    expect(msgs(["spec", "a", "b"])).toEqual(['unexpected argument "b"']);
    expect(msgs(["build", "z".repeat(30)])).toEqual([`unexpected argument "${"z".repeat(24)}"`]);
  });

  it("all diagnostics are collected, not just the first", () => {
    expect(msgs(["check", "--a", "--b"])).toEqual(["unknown flag --a", "unknown flag --b"]);
  });

  it("schema failures are E1052 with the raw value, clipped to 24 chars", () => {
    const m = msgs(["check", "--limit=abc"]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/^--limit value "abc" invalid \(\w+\)$/);
    const long = msgs(["check", `--format=${"q".repeat(40)}`]);
    expect(long[0]).toMatch(new RegExp(`^--format value "${"q".repeat(21)}\\.\\.\\." invalid`));
    const exact = msgs(["check", `--format=${"q".repeat(24)}`]);
    expect(exact[0]).toMatch(new RegExp(`^--format value "${"q".repeat(24)}" invalid`));
    const p = fails(["check", "--limit=abc"]);
    expect(p.diags[0]?.code).toBe("E1052");
    expect(p.diags[0]?.see).toBe("k.cli");
  });

  it("limit below 1 is rejected, 1 accepted", () => {
    expect(msgs(["check", "--limit=0"])).toEqual(["--limit value 0 invalid (min)"]);
    expect(msgs(["check", "--limit", "-5"])).toEqual(["--limit value -5 invalid (min)"]);
    expect(okParse(["check", "--limit=1"]).input).toStrictEqual({ limit: 1 });
    expect(okParse(["ledger"]).input).toStrictEqual({});
  });
});

describe("validateArgs", () => {
  it("null and undefined mean no arguments", () => {
    expect(validateArgs(op("check"), undefined)).toStrictEqual({ ok: true, input: {} });
    expect(validateArgs(op("check"), null)).toStrictEqual({ ok: true, input: {} });
    expect(validateArgs(op("check"), {})).toStrictEqual({ ok: true, input: {} });
  });

  it("non-objects are E1052", () => {
    for (const v of ["x", 5, [], [1], true]) {
      expect(validateArgs(op("check"), v)).toStrictEqual({
        ok: false,
        diags: [{ kind: "diag", code: "E1052", message: "arguments must be an object", see: "k.cli" }],
      });
    }
  });

  it("unknown arguments: one diag each, quoted, clipped at 24", () => {
    expect(validateArgs(op("check"), { zz: 1, yy: 2 })).toStrictEqual({
      ok: false,
      diags: [
        { kind: "diag", code: "E1052", message: 'unknown argument "zz"', see: "k.cli" },
        { kind: "diag", code: "E1052", message: 'unknown argument "yy"', see: "k.cli" },
      ],
    });
    const long = validateArgs(op("check"), { ["k".repeat(30)]: 1 });
    expect(long.ok ? [] : long.diags.map((d) => d.message)).toEqual([`unknown argument "${"k".repeat(24)}"`]);
    expect(validateArgs(op("ledger"), { id: "x" }).ok).toBe(false);
  });

  it("valid arguments are returned", () => {
    expect(validateArgs(op("check"), { paths: ["a"], limit: 2, quiet: true })).toStrictEqual({
      ok: true,
      input: { paths: ["a"], limit: 2, quiet: true },
    });
  });

  it("schema failures name the field as is, with the JSON value", () => {
    const r = validateArgs(op("check"), { limit: "abc" });
    const m = r.ok ? [] : r.diags.map((d) => d.message);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/^limit value "\\"abc\\"" invalid \(\w+\)$/);
    const r2 = validateArgs(op("check"), { limit: 1.5 });
    expect(r2.ok ? [] : r2.diags.map((d) => d.message)[0]).toMatch(/^limit value "1\.5" invalid \(\w+\)$/);
    expect(r2.ok ? [] : r2.diags.map((d) => d.code)).toEqual(["E1052"]);
  });

  it("limit below 1", () => {
    expect(validateArgs(op("check"), { limit: 0 })).toStrictEqual({
      ok: false,
      diags: [{ kind: "diag", code: "E1052", message: "limit value 0 invalid (min)", see: "k.cli" }],
    });
    expect(validateArgs(op("check"), { limit: -3 }).ok).toBe(false);
    expect(validateArgs(op("check"), { limit: 1 })).toStrictEqual({ ok: true, input: { limit: 1 } });
  });
});
