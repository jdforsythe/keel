import { globalRefs, unwrapExpression } from "@keel/compiler/internal";
import { type Argument, type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** `Intl` constructors that take a locale first. */
const INTL: ReadonlySet<string> = new Set([
  "NumberFormat",
  "DateTimeFormat",
  "PluralRules",
  "Collator",
  "ListFormat",
  "RelativeTimeFormat",
  "DisplayNames",
  "Segmenter",
]);
/** Date methods that format in a locale and a zone. */
const DATE_LOCALE: ReadonlySet<string> = new Set(["toLocaleDateString", "toLocaleTimeString"]);
/** Date getters that read the host time zone. */
const LOCAL_GETTERS: ReadonlySet<string> = new Set([
  "getHours",
  "getMinutes",
  "getSeconds",
  "getMilliseconds",
  "getDate",
  "getDay",
  "getMonth",
  "getFullYear",
  "getYear",
  "getTimezoneOffset",
]);

/** The member name of a static or literal-keyed member expression, else null. */
function memberName(e: Expression): string | null {
  if (e.type !== "MemberExpression") return null;
  if (!e.computed) return e.property.type === "Identifier" ? e.property.name : null;
  return e.property.type === "Literal" && typeof e.property.value === "string" ? e.property.value : null;
}

/** True when argument `i` is given and is not the literal `undefined`. */
const given = (args: readonly Argument[], i: number): boolean => {
  const a = args[i];
  return a !== undefined && !(a.type === "Identifier" && a.name === "undefined");
};

/** False only when the options argument is missing or an object literal (without spread) lacking `timeZone`. */
function hasZone(args: readonly Argument[], i: number): boolean {
  const o = args[i];
  if (o === undefined) return false;
  if (o.type !== "ObjectExpression") return true;
  return o.properties.some(
    (p) =>
      p.type === "SpreadElement" ||
      p.computed ||
      (p.key.type === "Identifier" && p.key.name === "timeZone") ||
      (p.key.type === "Literal" && p.key.value === "timeZone"),
  );
}

/**
 * E1758 (k.check): an ambient locale or time zone read in app code: `navigator.language`/`languages`; an `Intl`
 * constructor without a locale (`Intl.DateTimeFormat` also without `timeZone`); `toLocaleString` or
 * `localeCompare` without a locale; `toLocaleDateString`/`toLocaleTimeString` without a locale or `timeZone`; a
 * local-time getter on a `new Date(...)` expression. Names resolve as for E1601 (`globalRefs`). No fix: the locale
 * or zone is an argument the caller holds.
 */
export const noAmbientLocale: RuleDef = {
  code: "E1758",
  message: (f) => `${str(f.data, "what")} reads the host ${str(f.data, "reads")}; pass it as an argument`,
  explain: "The host's locale and zone differ between server and browser; the locale is route data, the zone app data.",
  see: "k.check",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const g = globalRefs(ast);
    const out: Finding[] = [];
    const report = (at: number, what: string, reads: string): void => {
      out.push(findingAt(file, at, { what, reads }));
    };
    const intl = (at: number, callee: Expression, args: readonly Argument[]): void => {
      const p = g.resolve(callee);
      const ctor = p?.length === 2 && p[0] === "Intl" ? p[1] : undefined;
      if (ctor === undefined || !INTL.has(ctor)) return;
      if (!given(args, 0)) report(at, `Intl.${ctor} without a locale`, "locale");
      else if (ctor === "DateTimeFormat" && !hasZone(args, 1))
        report(at, "Intl.DateTimeFormat without timeZone", "zone");
    };
    new Visitor({
      NewExpression: (n) => intl(n.start, n.callee, n.arguments),
      CallExpression: (n) => {
        intl(n.start, n.callee, n.arguments);
        const c = unwrapExpression(n.callee);
        const name = memberName(c);
        if (name === null || c.type !== "MemberExpression") return;
        if (name === "toLocaleString" || name === "localeCompare") {
          if (!given(n.arguments, name === "localeCompare" ? 1 : 0))
            report(c.start, `${name} without a locale`, "locale");
        } else if (DATE_LOCALE.has(name)) {
          if (!given(n.arguments, 0)) report(c.start, `${name} without a locale`, "locale");
          else if (!hasZone(n.arguments, 1)) report(c.start, `${name} without timeZone`, "zone");
        } else if (LOCAL_GETTERS.has(name)) {
          const made = unwrapExpression(c.object);
          if (made.type === "NewExpression" && g.resolve(made.callee)?.join(".") === "Date")
            report(c.start, `Date ${name}`, "zone");
        }
      },
      MemberExpression: (n) => {
        if (g.isAliasInit(n.start, n.end)) return;
        const p = g.resolve(n)?.join(".");
        if (p === "navigator.language" || p === "navigator.languages") report(n.start, p, "locale");
      },
    }).visit(ast);
    // A bare alias of a locale read (`const l = navigator.language` used as `l`) is reported at its uses.
    for (const r of g.refs) {
      if (g.isAliasInit(r.start, r.end)) continue;
      const p = g.resolveName(r.name, r.start)?.join(".");
      if (p === "navigator.language" || p === "navigator.languages") report(r.start, p, "locale");
    }
    return out;
  },
};
