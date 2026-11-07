import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Base inputs (k.ui) that bind to a form through `field`. */
const INPUTS: readonly string[] = ["Input", "TextArea", "Select", "Checkbox"];

/**
 * E1901 (k.forms): a base input from `@keel/ui` inside a `<Form>` from `@keel/router` with no `field` attribute
 * (an element with a spread attribute is skipped: the spread may carry it). No fix: the path is the author's.
 */
export const fieldInForm: RuleDef = {
  code: "E1901",
  message: (f) => `${str(f.data, "name")} inside a <Form> without field; bind it with field={f.field(path)}`,
  explain: "Inside a Form every input binds to a schema path, so values, errors and FormData agree.",
  see: "k.forms",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const forms = localNames(ast, "Form", "@keel/router");
    if (forms.size === 0) return [];
    const inputs = new Map<string, string>();
    for (const name of INPUTS) for (const local of localNames(ast, name, "@keel/ui")) inputs.set(local, name);
    const spans: { start: number; end: number }[] = [];
    const unbound: { start: number; name: string }[] = [];
    new Visitor({
      JSXElement: (n) => {
        const o = n.openingElement;
        if (o.name.type !== "JSXIdentifier") return;
        if (forms.has(o.name.name)) spans.push({ start: n.start, end: n.end });
        const base = inputs.get(o.name.name);
        if (base === undefined) return;
        const bound = o.attributes.some(
          (a) => a.type === "JSXSpreadAttribute" || (a.name.type === "JSXIdentifier" && a.name.name === "field"),
        );
        if (!bound) unbound.push({ start: n.start, name: base });
      },
    }).visit(ast);
    const out: Finding[] = [];
    for (const u of unbound) {
      if (spans.some((s) => u.start > s.start && u.start < s.end)) out.push(findingAt(file, u.start, { name: u.name }));
    }
    return out;
  },
};
