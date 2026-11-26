import { clipMessage } from "@keel/schema/internal";
import type { JSXOpeningElement } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { keyName } from "../internal/keyName.ts";
import { str } from "../internal/str.ts";
import { uiElementSites } from "../internal/uiElementSites.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;

/** The label keys of an element's `labels={{ ... }}` literal, or undefined when it is absent, computed or spread. */
function labelKeys(el: JSXOpeningElement | undefined): string[] | undefined {
  if (el === undefined) return undefined;
  for (const a of el.attributes) {
    if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== "labels") continue;
    const v = a.value;
    if (v?.type !== "JSXExpressionContainer" || v.expression.type !== "ObjectExpression") return undefined;
    const keys: string[] = [];
    for (const p of v.expression.properties) {
      if (p.type !== "Property") return undefined;
      const k = keyName(p);
      if (k === null) return undefined;
      keys.push(k);
    }
    return keys;
  }
  return undefined;
}

/**
 * E1816 (k.schemes Checks): a `ThemeSelect` of `@keel/ui` in an app or library file (`uiElementSites`: imports,
 * re-exports, namespace members) in a project whose tokens have no `choice` theme (a theme with no `when` or
 * `when: 'choice'`), at the element or call; or whose `labels` literal has a key other than `default` and the `choice`
 * themes (`ThemeSelect labels name no theme <key>`), or lacks a `choice` theme (`ThemeSelect labels lack <name>`). A
 * project whose `tokens.ts` gave no tokens judges none; with no `tokens.ts` the tokens have no theme.
 */
export const themeSelectChoice: RuleDef = {
  code: "E1816",
  message: (f) => {
    const kind = str(f.data, "kind");
    const name = clipMessage(str(f.data, "name"), 40);
    if (kind === "lack") return `ThemeSelect labels lack ${name}`;
    if (kind === "extra") return `ThemeSelect labels name no theme ${name}`;
    return "ThemeSelect needs a choice theme; the tokens have none";
  },
  see: "k.schemes",
  check: ({ file, ast, artifacts, project }) => {
    if (!isAppPath(file.path)) return [];
    const hasFile = project.some(
      (f) => /(?:^|\/)tokens\.ts$/.test(f.path) && !/(?:^|\/)(?:modules|node_modules)\//.test(f.path),
    );
    const tokens = isRec(artifacts.tokens) ? artifacts.tokens : undefined;
    if (tokens === undefined && hasFile) return [];
    const themes = tokens?.themes;
    const choice = isRec(themes)
      ? Object.entries(themes)
          .filter(([, t]) => !isRec(t) || t.when === undefined || t.when === "choice")
          .map(([name]) => name)
      : [];
    const out: Finding[] = [];
    for (const site of uiElementSites(file, ast, project, "ThemeSelect")) {
      if (choice.length === 0) {
        out.push(findingAt(file, site.at, { kind: "none" }));
        continue;
      }
      const keys = labelKeys(site.element);
      if (keys === undefined) continue;
      for (const name of choice) if (!keys.includes(name)) out.push(findingAt(file, site.at, { kind: "lack", name }));
      for (const name of keys)
        if (name !== "default" && !choice.includes(name)) out.push(findingAt(file, site.at, { kind: "extra", name }));
    }
    return out;
  },
};
