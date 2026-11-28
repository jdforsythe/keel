import { type Expression, parseSync } from "oxc-parser";
import type { Origins } from "../types/Origins.ts";
import type { TopologyProblem } from "../types/TopologyProblem.ts";
import { ORIGIN_DIRECTIVES } from "./ORIGIN_DIRECTIVES.ts";
import { isExactOrigin } from "./isExactOrigin.ts";
import { originDirectiveProblem } from "./originDirectiveProblem.ts";
import { originEntryProblem } from "./originEntryProblem.ts";
import { originOf } from "./originOf.ts";

const bare = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? bare(e.expression)
    : e;

/** The text of a non-computed key: an identifier's name or a string literal's value. */
const keyText = (k: { type: string; name?: unknown; value?: unknown }): string | undefined =>
  k.type === "Identifier" && typeof k.name === "string"
    ? k.name
    : k.type === "Literal" && typeof k.value === "string"
      ? k.value
      : undefined;

/**
 * The `origins` of each deployable of `topology.ts` (k.origins Declaration), read statically: the entries the read
 * accepts, by deployable and directive in declaration order (a deployable without one is absent), and the problems.
 * E1590 at the node for an `origins` or a directive that is not an object literal, a spread or computed key, a key
 * outside the five, a directive over 16 origins, an origin that is not exact (with a fix to its serialization when
 * `originOf` gives an exact one), and a reason that is not a string literal of the form; E1591 at an origin a
 * directive holds twice, or a directive `origins` holds twice, with a fix removing it (the first is the one read). Nothing is executed; no source, or a file the static read cannot take, gives none.
 */
export function declaredOrigins(source = ""): {
  origins: Record<string, Origins>;
  problems: TopologyProblem[];
} {
  const origins: Record<string, Origins> = {};
  const problems: TopologyProblem[] = [];
  const { program } = parseSync("topology.ts", source, { sourceType: "module", lang: "ts" });
  const def = program.body.find((s) => s.type === "ExportDefaultDeclaration")?.declaration;
  const top =
    def === undefined ||
    def.type === "FunctionDeclaration" ||
    def.type === "ClassDeclaration" ||
    def.type === "TSInterfaceDeclaration"
      ? undefined
      : bare(def);
  const arg = top?.type === "CallExpression" ? top.arguments[0] : top;
  const all = arg === undefined || arg.type === "SpreadElement" ? undefined : bare(arg);
  for (const p of all?.type === "ObjectExpression" ? all.properties : []) {
    const name = p.type === "Property" && !p.computed ? keyText(p.key) : undefined;
    const d = p.type === "Property" ? bare(p.value) : undefined;
    if (name === undefined || d?.type !== "ObjectExpression") continue;
    const at = d.properties.find((q) => q.type === "Property" && !q.computed && keyText(q.key) === "origins");
    if (at?.type !== "Property") continue;
    const e1590 = (message: string, start: number, fix?: TopologyProblem[4]): void => {
      problems.push(fix === undefined ? ["E1590", name, message, start] : ["E1590", name, message, start, fix]);
    };
    const value = bare(at.value);
    if (value.type !== "ObjectExpression") {
      e1590("origins is not an object literal", value.start);
      continue;
    }
    const read: { -readonly [K in keyof Origins]: Record<string, string> } = {};
    const directives = new Set<string>();
    let before = value.start + 1;
    for (const q of value.properties) {
      const key = q.type === "Property" && !q.computed ? keyText(q.key) : undefined;
      const after = before;
      before = q.end;
      if (q.type !== "Property" || key === undefined) {
        e1590("origins holds a spread or a computed key; write each directive out", q.start);
        continue;
      }
      if (directives.has(key)) {
        problems.push([
          "E1591",
          name,
          `origins: ${key} is written twice`,
          q.key.start,
          { start: after, end: q.end, text: "" },
        ]);
        continue;
      }
      directives.add(key);
      const directive = ORIGIN_DIRECTIVES.find((x) => x === key);
      if (directive === undefined) {
        e1590(originDirectiveProblem(key) ?? key, q.key.start);
        continue;
      }
      const entries = bare(q.value);
      if (entries.type !== "ObjectExpression") {
        e1590(`origins.${key} is not an object literal`, entries.start);
        continue;
      }
      if (entries.properties.length > 16) e1590(`origins.${key} holds more than 16 origins`, q.key.start);
      const kept: Record<string, string> = {};
      const seen = new Set<string>();
      let previous = entries.start + 1;
      for (const r of entries.properties) {
        const origin = r.type === "Property" && !r.computed ? keyText(r.key) : undefined;
        const after = previous;
        previous = r.end;
        if (r.type !== "Property" || origin === undefined) {
          e1590(`origins.${key} holds a spread or a computed key; write each origin out`, r.start);
          continue;
        }
        if (seen.has(origin)) {
          problems.push([
            "E1591",
            name,
            `origins.${key}: ${origin} is declared twice`,
            r.key.start,
            { start: after, end: r.end, text: "" },
          ]);
          continue;
        }
        seen.add(origin);
        const reason = bare(r.value);
        const text = reason.type === "Literal" && typeof reason.value === "string" ? reason.value : undefined;
        const problem = originEntryProblem(key, origin, text);
        if (problem === undefined && text !== undefined) {
          kept[origin] = text;
          continue;
        }
        const serial = originOf(origin);
        const fix =
          !isExactOrigin(origin) && serial !== undefined && isExactOrigin(serial) && r.key.type === "Literal"
            ? {
                start: r.key.start,
                end: r.key.end,
                text: JSON.stringify(serial).replace(/"/g, source[r.key.start] ?? "'"),
              }
            : undefined;
        e1590(problem ?? `origins.${key}: the reason for ${origin} is not a string literal`, r.key.start, fix);
      }
      if (Object.keys(kept).length > 0) read[directive] = kept;
    }
    if (Object.keys(read).length > 0) origins[name] = read;
  }
  return { origins, problems };
}
