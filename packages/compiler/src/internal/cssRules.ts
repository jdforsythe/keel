import type { CssRule } from "../types/CssRule.ts";

type Context = {
  readonly layers: readonly string[];
  readonly media: readonly string[];
  readonly wrappers: readonly string[];
};

/**
 * The style rules of `text` that declare something, in document order, nested at-rules and nested style rules
 * flattened (a nested rule's selector is its parent's, a space, and its own; it follows its parent). Every at-rule
 * with a block is read, none skipped: `@media` and `@layer` go to their lists, any other (`@supports`, `@container`,
 * `@scope`, `@starting-style`, `@keyframes`, one this reader does not know) to `wrappers`, and declarations an
 * at-rule holds outside any style rule (`@font-face`) form a rule of selector `""`. Comments are dropped and strings
 * kept whole; an unclosed block ends at the end of the text.
 */
export function cssRules(text: string): CssRule[] {
  const src = text.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, "");
  const slots: (CssRule | undefined)[] = [];
  let i = 0;

  /** Text up to (not past) the first of `stops` outside strings, parentheses and brackets. */
  const until = (stops: string): string => {
    const from = i;
    let depth = 0;
    while (i < src.length) {
      const c = src[i] ?? "";
      if (c === '"' || c === "'") {
        i++;
        while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
      } else if (c === "(" || c === "[") depth++;
      else if ((c === ")" || c === "]") && depth > 0) depth--;
      else if (depth === 0 && stops.includes(c)) break;
      i++;
    }
    return src.slice(from, i);
  };

  /** A block's contents up to its `}` (or the text's end): rules, and declarations when `selector` is set. */
  const block = (ctx: Context, selector: string | undefined): void => {
    const slot = slots.length;
    const decls: { prop: string; value: string }[] = [];
    if (selector !== undefined) slots.push(undefined);
    while (i < src.length) {
      const head = until(";{}");
      const c = src[i];
      i++;
      if (c === "{") {
        const at = head.trim();
        const name = at.startsWith("@") ? (/^@([\w-]+)/.exec(at)?.[1] ?? "").toLowerCase() : undefined;
        const prelude = name === undefined ? "" : at.slice(name.length + 1).trim();
        const within = selector ?? "";
        if (name === undefined) block(ctx, within === "" ? at : `${within} ${at}`);
        else if (name === "media") block({ ...ctx, media: [...ctx.media, prelude] }, within);
        else if (name === "layer") block({ ...ctx, layers: [...ctx.layers, prelude] }, within);
        else block({ ...ctx, wrappers: [...ctx.wrappers, `@${name} ${prelude}`.trim()] }, within);
        continue;
      }
      const colon = head.indexOf(":");
      if (selector !== undefined && colon > 0 && !head.trim().startsWith("@")) {
        const prop = head.slice(0, colon).trim();
        if (prop !== "") decls.push({ prop, value: head.slice(colon + 1).trim() });
      }
      if (c === "}") break;
    }
    if (selector !== undefined && decls.length > 0) slots[slot] = { selector, ...ctx, decls };
  };

  while (i < src.length) block({ layers: [], media: [], wrappers: [] }, undefined);
  return slots.filter((r): r is CssRule => r !== undefined);
}
