import { type Expression, type ObjectExpression, type PropertyKey, Visitor, parseSync } from "oxc-parser";
import type { Danger } from "./Danger.ts";
import type { FileKind } from "./FileKind.ts";
import type { Raw } from "./Raw.ts";
import { foldString } from "./foldString.ts";

/** A TypeScript suppression comment, as E1757 reads one. */
const SUPPRESSION = /@ts-(?:ignore|expect-error|nocheck)\b/;
/** A lint suppression comment's start (R1051). */
const LINT_OFF = /^[\s*]*(?:eslint-disable|biome-ignore|oxlint-disable)/;
/** A folded string that would act as a suppression directive once written into a comment (R1052). */
const DIRECTIVE = /^\s*(?:\/\/+|\/\*+)?\s*(?:@ts-|eslint-disable|biome-ignore|oxlint-disable)/;
const PRIVATE_KEEL = /^@keel\/[^/]+\/(?:[^/]+\/)*(?:src|dist|unsafe)(?:\/|$)/;
const INTO_KEEL = /(?:^|\/)node_modules\/@keel\//;
const NODE_IO = /^(?:node:)?(fs|net|http|https|child_process)(?:\/|$)/;
const GLOBALS = new Set(["globalThis", "window", "self", "global"]);
const TEST_ROOTS = new Set(["test", "it", "describe", "suite"]);
const TEST_MODS = new Set(["only", "skip", "todo", "skipIf", "fails"]);
const DIRECTIVES: ReadonlyMap<string, Danger> = new Map([
  ["connect", "high"],
  ["frame", "high"],
  ["img", "low"],
  ["media", "low"],
  ["font", "low"],
]);

const langOf = (path: string): "js" | "jsx" | "ts" | "tsx" =>
  /\.tsx$/.test(path) ? "tsx" : /\.[cm]?ts$/.test(path) ? "ts" : /\.jsx$/.test(path) ? "jsx" : "js";

/** A property key's name: an identifier, or a string literal, computed or not; else null. */
function keyName(k: PropertyKey, computed: boolean): string | null {
  if (k.type === "Identifier" && !computed) return k.name;
  if (k.type === "Literal" && typeof k.value === "string") return k.value;
  return null;
}

/** The properties of an object literal by name (spreads and computed keys skipped). */
function props(o: ObjectExpression): { name: string; start: number; end: number; value: Expression }[] {
  const out: { name: string; start: number; end: number; value: Expression }[] = [];
  for (const p of o.properties) {
    if (p.type !== "Property") continue;
    const name = keyName(p.key, p.computed);
    if (name !== null) out.push({ name, start: p.start, end: p.end, value: p.value });
  }
  return out;
}

/** A string literal or a template with no substitution: a specifier the checker reads. */
const isLiteralText = (e: Expression): boolean =>
  (e.type === "Literal" && typeof e.value === "string") || (e.type === "TemplateLiteral" && e.expressions.length === 0);

/**
 * A template the bundler expands to the files beside the importer, as Vite's dynamic imports require: it starts `./`
 * or `../` and ends in a file extension (std.messages' `` import(`./<Set>/${locale}.ts`) ``). It names no package.
 */
const isLocalGlob = (e: Expression): boolean => {
  if (e.type !== "TemplateLiteral") return false;
  const head = e.quasis[0]?.value.cooked ?? "";
  const tail = e.quasis.at(-1)?.value.cooked ?? "";
  return /^\.\.?\//.test(head) && /\.[A-Za-z0-9]+$/.test(tail) && e.quasis.length > 1;
};

/** `new URL('<literal>', import.meta.url)`: the bundler's own form for a worker or asset next to the file. */
const isUrlBesideFile = (e: Expression): boolean =>
  e.type === "NewExpression" &&
  e.callee.type === "Identifier" &&
  e.callee.name === "URL" &&
  e.arguments[0] !== undefined &&
  e.arguments[0].type !== "SpreadElement" &&
  isLiteralText(e.arguments[0]);

/** The identifier a member chain starts at (`test` of `test.concurrent.only`), or null. */
function rootOf(e: Expression): string | null {
  if (e.type === "Identifier") return e.name;
  return e.type === "MemberExpression" ? rootOf(e.object) : null;
}

/** Whether a member chain names one of `names` as a non-computed property. */
function hasMember(e: Expression, names: ReadonlySet<string>): boolean {
  if (e.type !== "MemberExpression") return false;
  if (!e.computed && e.property.type === "Identifier" && names.has(e.property.name)) return true;
  return hasMember(e.object, names);
}

/** `process.env`, by name or literal key. */
const isProcessEnv = (e: Expression): boolean =>
  e.type === "MemberExpression" &&
  e.object.type === "Identifier" &&
  e.object.name === "process" &&
  (e.computed
    ? e.property.type === "Literal" && e.property.value === "env"
    : e.property.type === "Identifier" && e.property.name === "env");

/** A function returning 1-based line and column for a UTF-16 offset of `source`. */
function locator(source: string): (at: number) => { line: number; col: number } {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) starts.push(i + 1);
  return (at) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] ?? 0) <= at) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: at - (starts[lo] ?? 0) + 1 };
  };
}

/**
 * The escapes one code file holds (k.escapes): every row read by syntax. A file that does not parse is one R1150 and
 * nothing else. `kind` says where the file sits; it decides R1050, R1057, R1058, R1059 and R1010. R2451 is an `allow` of
 * the object a `.transaction(` call takes: `'lost updates'` high, any other value the row's medium; `reason` its reason.
 */
export function codeEscapes(path: string, source: string, kind: FileKind): Raw[] {
  const parsed = parseSync(path, source, { sourceType: "module", lang: langOf(path) });
  const at = locator(source);
  const first = parsed.errors[0];
  if (first !== undefined) {
    const { line, col } = at(first.labels[0]?.start ?? 0);
    return [{ code: "R1150", line, col, text: "", message: `does not parse: ${first.message}` }];
  }
  const out: Raw[] = [];
  const add = (code: string, start: number, end: number, extra: Omit<Raw, "code" | "line" | "col" | "text"> = {}) =>
    void out.push({ code, ...at(start), text: source.slice(start, end), ...extra });
  let folded = -1;
  const envs = new Set<number>();
  let unsafeCalls = 0;

  const specifier = (start: number, end: number, spec: string): void => {
    if (PRIVATE_KEEL.test(spec) || (spec.startsWith(".") && INTO_KEEL.test(spec))) add("R1055", start, end);
    const io = NODE_IO.exec(spec);
    if (io !== null && (kind.server || kind.test))
      add("R1057", start, end, {
        message: `${spec} imported in a ${kind.test ? "test" : "server"} file`,
        ...(io[1] === "child_process" ? { danger: "critical" as const } : {}),
      });
  };
  const fold = (n: Expression): void => {
    if (n.start < folded) return;
    const v = foldString(n);
    if (v === null) return;
    folded = n.end;
    if (DIRECTIVE.test(v)) add("R1052", n.start, n.end);
  };
  const evalRef = (e: Expression | null | undefined): void => {
    if (e?.type === "Identifier" && e.name === "eval")
      add("R1056", e.start, e.end, { message: "eval used indirectly" });
  };

  for (const st of parsed.program.body)
    if (
      (st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration" || st.type === "ExportNamedDeclaration") &&
      st.source !== null &&
      st.source !== undefined
    )
      specifier(st.source.start, st.source.end, st.source.value);

  new Visitor({
    Literal: (n) => fold(n),
    TemplateLiteral: (n) => fold(n),
    BinaryExpression: (n) => fold(n),
    TaggedTemplateExpression: (n) => fold(n),
    CallExpression: (n) => {
      fold(n);
      const c = n.callee;
      const a0 = n.arguments[0];
      const arg = a0 === undefined || a0.type === "SpreadElement" ? undefined : a0;
      for (const a of n.arguments) if (a.type !== "SpreadElement") evalRef(a);
      if (c.type === "Identifier") {
        if (c.name === "unsafe") {
          unsafeCalls++;
          const reason = arg === undefined ? null : foldString(arg);
          add("R1001", n.start, n.end, reason === null ? {} : { reason });
        } else if (c.name === "reveal") add("R1012", n.start, n.end);
        else if (c.name === "require" && arg !== undefined) {
          if (isLiteralText(arg)) {
            const spec = foldString(arg);
            if (spec !== null) specifier(arg.start, arg.end, spec);
          } else add("R1053", n.start, n.end);
        } else if (c.name === "fetch" && kind.unsafeDir && (kind.server || kind.test))
          add("R1057", n.start, n.end, { message: "fetch outside ctx in a server or test file" });
        else if ((c.name === "createApp" || c.name === "identity") && arg?.type === "ObjectExpression") {
          for (const p of props(arg)) {
            if (c.name === "createApp" && p.name === "allow") add("R1011", p.start, p.end);
            if (c.name === "identity" && p.name === "handle") add("R1014", p.start, p.end);
            if (c.name === "createApp" && p.name === "identity" && p.value.type === "ObjectExpression")
              for (const h of props(p.value)) if (h.name === "handle") add("R1014", h.start, h.end);
          }
        }
      }
      if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier") {
        if (c.property.name === "transaction")
          for (const a of n.arguments) {
            if (a.type !== "ObjectExpression") continue;
            const ps = props(a);
            const allow = ps.find((p) => p.name === "allow");
            if (allow === undefined) continue;
            const given = foldString(allow.value);
            const why = ps.find((p) => p.name === "reason");
            const reason = why === undefined ? null : foldString(why.value);
            add("R2451", allow.start, allow.end, {
              message: `a transaction allows ${given ?? "an anomaly"}`,
              ...(given === "lost updates" ? { danger: "high" as const } : {}),
              ...(reason === null ? {} : { reason }),
            });
          }
      }
      if (
        c.type === "MemberExpression" &&
        !c.computed &&
        c.property.type === "Identifier" &&
        c.property.name === "resolve" &&
        c.object.type === "MetaProperty" &&
        arg !== undefined &&
        !isLiteralText(arg)
      )
        add("R1053", n.start, n.end);
      if (kind.test && c.type === "MemberExpression" && hasMember(c, TEST_MODS)) {
        const root = rootOf(c);
        if (root !== null && TEST_ROOTS.has(root)) add("R1059", n.start, arg?.end ?? c.end);
      }
    },
    ImportExpression: (n) => {
      if (!isLiteralText(n.source) && !isLocalGlob(n.source)) add("R1053", n.start, n.end);
      else {
        const spec = foldString(n.source);
        if (spec !== null) specifier(n.source.start, n.source.end, spec);
      }
    },
    NewExpression: (n) => {
      const a0 = n.arguments[0];
      if (
        n.callee.type === "Identifier" &&
        (n.callee.name === "Worker" || n.callee.name === "SharedWorker") &&
        a0 !== undefined &&
        (a0.type === "SpreadElement" || (!isLiteralText(a0) && !isUrlBesideFile(a0)))
      )
        add("R1053", n.start, n.end);
    },
    MemberExpression: (n) => {
      const o = n.object;
      if (o.type === "Identifier" && GLOBALS.has(o.name)) {
        const p = n.property;
        const literalKey = !n.computed || (p.type !== "PrivateIdentifier" && isLiteralText(p));
        if (!literalKey) add("R1056", n.start, n.end);
        else if (p.type === "Identifier" ? p.name === "eval" : p.type === "Literal" && p.value === "eval")
          add("R1056", n.start, n.end, { message: "eval used indirectly" });
      }
      // `process.env.KEY` is one read: its text is the whole member, so a changed key reads as `changed`.
      const env = isProcessEnv(n)
        ? n
        : n.object.type === "MemberExpression" && isProcessEnv(n.object)
          ? n.object
          : null;
      if ((kind.server || kind.test) && env !== null && !envs.has(env.start)) {
        envs.add(env.start);
        add("R1057", n.start, n.end, { message: `process.env read in a ${kind.test ? "test" : "server"} file` });
      }
    },
    SequenceExpression: (n) => evalRef(n.expressions.at(-1)),
    VariableDeclarator: (n) => evalRef(n.init),
    AssignmentExpression: (n) => evalRef(n.right),
    Property: (n) => {
      if (!kind.topology || keyName(n.key, n.computed) !== "origins" || n.value.type !== "ObjectExpression") return;
      for (const d of props(n.value)) {
        const danger = DIRECTIVES.get(d.name);
        if (danger === undefined || d.value.type !== "ObjectExpression") continue;
        for (const o of props(d.value)) {
          const reason = foldString(o.value);
          add("R1010", o.start, o.end, {
            danger,
            message: `a declared ${d.name} origin: ${o.name}`,
            ...(reason === null ? {} : { reason }),
          });
        }
      }
    },
    TSAsExpression: (n) => {
      const t = n.typeAnnotation;
      const isConst = t.type === "TSTypeReference" && t.typeName.type === "Identifier" && t.typeName.name === "const";
      if (!kind.app && !isConst)
        add("R1050", n.start, n.end, { message: "a type cast where keel check does not read" });
    },
    TSTypeAssertion: (n) => {
      if (!kind.app) add("R1050", n.start, n.end, { message: "a type cast where keel check does not read" });
    },
    TSNonNullExpression: (n) => {
      if (!kind.app) add("R1050", n.start, n.end, { message: "a non-null assertion where keel check does not read" });
    },
    TSAnyKeyword: (n) => {
      if (!kind.app) add("R1050", n.start, n.end, { message: "any where keel check does not read" });
    },
  }).visit(parsed.program);

  for (const c of parsed.comments) {
    if (!kind.app && SUPPRESSION.test(c.value))
      add("R1050", c.start, c.end, { message: "a ts suppression comment where keel check does not read" });
    if (LINT_OFF.test(c.value)) add("R1051", c.start, c.end);
  }
  if (kind.unsafeDir && unsafeCalls === 0) out.push({ code: "R1058", line: 1, col: 1, text: "" });
  return out.sort((a, b) => a.line - b.line || a.col - b.col || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}
