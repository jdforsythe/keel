import { type JSXAttributeItem, Visitor } from "oxc-parser";
import { ensureImport } from "../internal/ensureImport.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const BOX_AS: ReadonlySet<string> = new Set([
  "section",
  "nav",
  "main",
  "header",
  "footer",
  "aside",
  "article",
  "ul",
  "ol",
  "li",
]);
const TEXT_AS: ReadonlySet<string> = new Set(["p", "strong", "em", "small", "code", "pre", "blockquote"]);
/** Base elements with no drop-in rename (required props differ): named in the message, no fix. */
const SUGGEST: ReadonlyMap<string, string> = new Map([
  ["a", "Link"],
  ["img", "Image"],
  ["input", "Input"],
  ["textarea", "TextArea"],
  ["select", "Select"],
  ["label", "Input"],
]);
/** Phrasing tags outside `Text as` that map to its nearest tag. */
const TEXT_LIKE: ReadonlyMap<string, string> = new Map([
  ["b", "strong"],
  ["i", "em"],
]);

/** `[base element, extra attributes]` for a drop-in replacement of `tag`, or null. */
function dropIn(tag: string): [string, string] | null {
  if (tag === "div") return ["Box", ""];
  if (tag === "span") return ["Text", ""];
  if (tag === "button") return ["Button", ""];
  if (BOX_AS.has(tag)) return ["Box", ` as="${tag}"`];
  if (TEXT_AS.has(tag)) return ["Text", ` as="${tag}"`];
  const like = TEXT_LIKE.get(tag);
  if (like !== undefined) return ["Text", ` as="${like}"`];
  const h = /^h([1-6])$/.exec(tag);
  if (h !== null) return ["Heading", ` level={${h[1]}}`];
  return null;
}

const onlyId = (attrs: readonly JSXAttributeItem[]): boolean =>
  attrs.every((a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "id");

/**
 * E1805 (k.ui): a lowercase intrinsic element in app code. Fix: the matching base element from `@keel/ui`
 * when it is a drop-in (no attributes besides `id`); the message always names the base element (`Box` for
 * tags with no closer match).
 */
export const noIntrinsicElement: RuleDef = {
  code: "E1805",
  message: (f) => {
    const base = str(f.data, "base");
    const tag = str(f.data, "tag");
    return base === ""
      ? `<${tag}> in app code; use a @keel/ui base element`
      : `<${tag}> in app code; use <${base}> from @keel/ui`;
  },
  see: "k.ui",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || !/\.[jt]sx$/.test(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      JSXElement: (n) => {
        const o = n.openingElement;
        if (o.name.type !== "JSXIdentifier" || !/^[a-z][a-z0-9]*$/.test(o.name.name)) return;
        const tag = o.name.name;
        const fit = dropIn(tag);
        const close = n.closingElement;
        out.push(
          findingAt(file, o.name.start, {
            tag,
            base: fit?.[0] ?? SUGGEST.get(tag) ?? "Box",
            extra: fit?.[1] ?? "",
            fixable: fit !== null && onlyId(o.attributes) ? 1 : 0,
            openStart: o.name.start,
            openEnd: o.name.end,
            closeStart: close?.name.start ?? -1,
            closeEnd: close?.name.end ?? -1,
          }),
        );
      },
    }).visit(ast);
    return out;
  },
  fix: (f, { ast }) => {
    if (num(f.data, "fixable", 0) !== 1) return null;
    const base = str(f.data, "base");
    const closeStart = num(f.data, "closeStart");
    return [
      ...ensureImport(ast, base, "@keel/ui"),
      { start: num(f.data, "openStart"), end: num(f.data, "openEnd"), text: `${base}${str(f.data, "extra")}` },
      ...(closeStart < 0 ? [] : [{ start: closeStart, end: num(f.data, "closeEnd"), text: base }]),
    ];
  },
};
