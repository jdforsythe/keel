import { type Argument, type Expression, type Program, Visitor } from "oxc-parser";
import type { LocaleCall } from "./LocaleCall.ts";

/** Each `Intl` formatter with the stdlib function that replaces it (std.i18n, std.text, std.temporal). */
const INTL: Readonly<Record<string, string>> = {
  Collator: "compareText",
  DateTimeFormat: "formatDate or formatInstant",
  DisplayNames: "localeName",
  DurationFormat: "formatDuration",
  NumberFormat: "formatNumber",
  PluralRules: "plural",
  RelativeTimeFormat: "formatDuration",
};

/** Each locale-taking method, the index of its locale argument, and the stdlib function that replaces it. */
const METHODS: Readonly<Record<string, { readonly at: number; readonly use: string }>> = {
  localeCompare: { at: 1, use: "compareText" },
  toLocaleDateString: { at: 0, use: "formatDate" },
  toLocaleString: { at: 0, use: "formatNumber, formatMoney or formatInstant" },
  toLocaleTimeString: { at: 0, use: "formatInstant" },
};

/** Whether an argument is given and is not the identifier `undefined` (which asks for the host locale). */
function given(a: Argument | undefined): boolean {
  return a !== undefined && !(a.type === "Identifier" && a.name === "undefined");
}

/** `{ style: 'currency' }` among an `Intl.NumberFormat`'s options. */
function isCurrency(a: Argument | undefined): boolean {
  if (a?.type !== "ObjectExpression") return false;
  return a.properties.some(
    (p) =>
      p.type === "Property" &&
      !p.computed &&
      p.key.type === "Identifier" &&
      p.key.name === "style" &&
      p.value.type === "Literal" &&
      p.value.value === "currency",
  );
}

/** The `Intl` member a callee names (`Intl.NumberFormat`), or `null`. */
function intlMember(callee: Expression): string | null {
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return null;
  return callee.object.type === "Identifier" && callee.object.name === "Intl" ? callee.property.name : null;
}

function intlCall(start: number, callee: Expression, args: readonly Argument[]): LocaleCall | null {
  const name = intlMember(callee);
  const use = name === null ? undefined : INTL[name];
  if (name === null || use === undefined || !given(args[0])) return null;
  const money = name === "NumberFormat" && isCurrency(args[1]);
  return { start, what: `Intl.${name}`, use: money ? "formatMoney" : use };
}

function methodCall(start: number, callee: Expression, args: readonly Argument[]): LocaleCall | null {
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return null;
  const name = callee.property.name;
  const m = METHODS[name];
  return m !== undefined && given(args[m.at]) ? { start, what: name, use: m.use } : null;
}

/** Every `Intl` formatter constructed, or locale method called, with a locale argument, in source order. */
export function localeCalls(ast: Program): LocaleCall[] {
  const out: LocaleCall[] = [];
  new Visitor({
    NewExpression: (n) => {
      const c = intlCall(n.start, n.callee, n.arguments);
      if (c !== null) out.push(c);
    },
    CallExpression: (n) => {
      const c = intlCall(n.start, n.callee, n.arguments) ?? methodCall(n.start, n.callee, n.arguments);
      if (c !== null) out.push(c);
    },
  }).visit(ast);
  return out.sort((a, b) => a.start - b.start);
}
