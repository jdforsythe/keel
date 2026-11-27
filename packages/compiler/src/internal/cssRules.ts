import type { CssRule } from "../types/CssRule.ts";

/** At-rules whose block holds rules; any other at-rule's block (`@font-face`, `@keyframes`, `@property`) is skipped. */
const GROUPING = new Set(["media", "layer", "supports", "container", "scope", "document", "starting-style"]);

type Context = {
  readonly layers: readonly string[];
  readonly media: readonly string[];
  readonly supports: readonly string[];
};

/**
 * The style rules of `text` that declare something, in document order, nested at-rules and nested style rules
 * flattened (a nested rule's selector is its parent's, a space, and its own; it follows its parent). Comments are
 * dropped and strings kept whole; an unclosed block ends at the end of the text.
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

  /** Past a block whose `{` was read, nested blocks included. */
  const skip = (): void => {
    let depth = 1;
    while (i < src.length && depth > 0) {
      until("{}");
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
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
        if (name === undefined) block(ctx, selector === undefined ? at : `${selector} ${at}`);
        else if (!GROUPING.has(name)) skip();
        else if (name === "media") block({ ...ctx, media: [...ctx.media, prelude] }, selector);
        else if (name === "layer") block({ ...ctx, layers: [...ctx.layers, prelude] }, selector);
        else if (name === "supports") block({ ...ctx, supports: [...ctx.supports, prelude] }, selector);
        else block(ctx, selector);
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

  while (i < src.length) block({ layers: [], media: [], supports: [] }, undefined);
  return slots.filter((r): r is CssRule => r !== undefined);
}
