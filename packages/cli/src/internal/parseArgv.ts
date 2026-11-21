import type { Operation } from "../types/Operation.ts";
import type { Diag } from "./Diag.ts";
import type { Parsed } from "./Parsed.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { issueDiags } from "./issueDiags.ts";
import { makeDiag } from "./makeDiag.ts";
import { sniffFormat } from "./sniffFormat.ts";

/** Canonical integer text: no sign but `-`, no leading zeros, no exponent or fraction. */
const INT_TEXT = /^(0|-?[1-9][0-9]*)$/;

const badInt = (flag: string, v: string): Diag =>
  makeDiag("E1052", `--${flag} value ${JSON.stringify(v.length > 24 ? `${v.slice(0, 21)}...` : v)} invalid (int)`, {
    see: "k.cli",
  });

const usage = (command: string, argv: readonly string[], diags: Diag[]): Parsed => ({
  ok: false,
  command,
  format: sniffFormat(argv),
  diags,
});

/**
 * Parse argv against the command table. Flags are `--name`, `--name=value` or `--name value`; booleans take no
 * value. Bare words fill the operation's positional fields in order (an array field takes the rest). The text is
 * coerced and validated by the operation's input schema (`decodeStrings`), so every invalid value is E1052.
 * E1051 for an unknown or missing command (`session` and `report` are answered earlier, in runEngine, with I1055).
 */
export function parseArgv(argv: readonly string[], ops: readonly Operation[]): Parsed {
  const name = argv[0];
  const op = ops.find((o) => o.name === name);
  if (name === undefined || name.startsWith("-"))
    return usage("keel", argv, [makeDiag("E1051", "no command given; see keel docs k.cli", { see: "k.cli" })]);
  if (op === undefined) {
    const msg = `unknown command ${JSON.stringify(name.slice(0, 24))}`;
    return usage(name, argv, [makeDiag("E1051", msg, { see: "k.cli" })]);
  }
  const fields = fieldsOf(op);
  const entries = new Map<string, string[]>();
  const diags: Diag[] = [];
  const positional = [...op.positional];
  const add = (k: string, v: string): void => {
    entries.set(k, [...(entries.get(k) ?? []), v]);
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a.startsWith("-") && a.length > 1) {
      const body = a.replace(/^--?/, "");
      const eq = body.indexOf("=");
      const flag = eq < 0 ? body : body.slice(0, eq);
      const node = fields.get(flag);
      if (!a.startsWith("--") || node === undefined || op.positional.includes(flag)) {
        const shown = eq < 0 ? a : a.slice(0, a.indexOf("="));
        diags.push(makeDiag("E1052", `unknown flag ${shown.slice(0, 30)}`, { see: "k.cli" }));
        continue;
      }
      if (entries.has(flag) && node.kind !== "array") {
        diags.push(makeDiag("E1052", `flag --${flag} given twice`, { see: "k.cli" }));
        continue;
      }
      if (eq >= 0 && eq === body.length - 1 && node.kind === "int") {
        diags.push(makeDiag("E1052", `flag --${flag} needs a value`, { see: "k.cli" }));
        continue;
      }
      const intText = (v: string): boolean => node.kind !== "int" || INT_TEXT.test(v);
      if (eq >= 0) {
        const v = body.slice(eq + 1);
        if (!intText(v)) {
          diags.push(badInt(flag, v));
          continue;
        }
        add(flag, v);
      } else if (node.kind === "boolean") add(flag, "true");
      else {
        const next = argv[i + 1];
        if (next === undefined || (next.startsWith("--") && next.length > 2)) {
          diags.push(makeDiag("E1052", `flag --${flag} needs a value`, { see: "k.cli" }));
          continue;
        }
        if (!intText(next)) {
          diags.push(badInt(flag, next));
          i++;
          continue;
        }
        add(flag, next);
        i++;
      }
      continue;
    }
    const field = positional[0];
    if (field === undefined) {
      diags.push(makeDiag("E1052", `unexpected argument ${JSON.stringify(a.slice(0, 24))}`, { see: "k.cli" }));
      continue;
    }
    add(field, a);
    if (fields.get(field)?.kind !== "array") positional.shift();
  }
  if (diags.length > 0) return usage(name, argv, diags);
  const decoded = op.input.decodeStrings(Object.fromEntries(entries));
  const label = (f: string): string => (op.positional.includes(f) ? `argument ${f}` : `--${f}`);
  if (!decoded.ok)
    return usage(
      name,
      argv,
      issueDiags(decoded.error, label, (f) => entries.get(f)?.[0]),
    );
  const input = decoded.value;
  if (input.limit !== undefined && input.limit < 1)
    return usage(name, argv, [makeDiag("E1052", `--limit value ${input.limit} invalid (min)`, { see: "k.cli" })]);
  return { ok: true, op, input };
}
