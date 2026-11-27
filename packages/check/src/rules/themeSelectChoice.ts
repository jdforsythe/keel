import type { JSXOpeningElement, ObjectProperty } from "oxc-parser";
import { dropThemeSelect } from "../internal/dropThemeSelect.ts";
import { findingAt } from "../internal/findingAt.ts";
import { fitNames } from "../internal/fitNames.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { keyName } from "../internal/keyName.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import { uiSitesOf } from "../internal/uiSitesOf.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;

/** An element's `labels={{ ... }}` literal: its properties by key and where a new one goes; undefined when absent, computed or spread. */
type Labels = {
  readonly props: readonly (readonly [string, ObjectProperty])[];
  readonly addAt: number;
  readonly first: boolean;
};

function labelsOf(el: JSXOpeningElement | undefined): Labels | undefined {
  if (el === undefined) return undefined;
  for (const a of el.attributes) {
    if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== "labels") continue;
    const v = a.value;
    if (v?.type !== "JSXExpressionContainer" || v.expression.type !== "ObjectExpression") return undefined;
    const props: [string, ObjectProperty][] = [];
    for (const p of v.expression.properties) {
      if (p.type !== "Property") return undefined;
      const k = keyName(p);
      if (k === null) return undefined;
      props.push([k, p]);
    }
    const last = props.at(-1)?.[1];
    return { props, addAt: last?.end ?? v.expression.start + 1, first: last === undefined };
  }
  return undefined;
}

/** The range deleting property `i` of `props` and one comma beside it. */
function dropRange(props: Labels["props"], i: number): { from: number; to: number } {
  const p = props[i]?.[1];
  const next = props[i + 1]?.[1];
  const prev = props[i - 1]?.[1];
  if (p === undefined) return { from: 0, to: 0 };
  if (next !== undefined) return { from: p.start, to: next.start };
  return { from: prev?.end ?? p.start, to: p.end };
}

/**
 * E1816 (k.schemes Checks): a `ThemeSelect` of `@keel/ui` in an app or library file (with the type pass on, the ones the checker
 * resolves to it; without, `uiElementSites`: imports, re-exports, namespace members) in a project whose tokens have no `choice` theme (a theme with no `when` or
 * `when: 'choice'`), at the element or call; or whose `labels` literal has a key other than `default` and the `choice`
 * themes (`ThemeSelect labels name no theme <key>`), or lacks a `choice` theme (`ThemeSelect labels lack <name>`). A
 * project whose `tokens.ts` gave no tokens judges none; with no `tokens.ts` the tokens have no theme. The message fits
 * 89 units by clipping the name (`fitNames`). Fixes (k.themes Fixes): `<name>: "<name>"` added after the last property
 * of `labels`; the extra property and its comma deleted; for no choice theme, at a JSX element, `dropThemeSelect`.
 */
export const themeSelectChoice: RuleDef = {
  code: "E1816",
  message: (f) => {
    const kind = str(f.data, "kind");
    const name = str(f.data, "name");
    if (kind === "lack") return fitNames(([n]) => `ThemeSelect labels lack ${n}`, [name]);
    if (kind === "extra") return fitNames(([n]) => `ThemeSelect labels name no theme ${n}`, [name]);
    return "ThemeSelect needs a choice theme; the tokens have none";
  },
  see: "k.schemes",
  check: ({ file, ast, artifacts, project, themeSelects }) => {
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
    for (const site of uiSitesOf(file, ast, project, "ThemeSelect", themeSelects)) {
      if (choice.length === 0) {
        out.push(
          findingAt(file, site.at, site.element === undefined ? { kind: "none" } : { kind: "none", element: site.at }),
        );
        continue;
      }
      const labels = labelsOf(site.element);
      if (labels === undefined) continue;
      const keys = labels.props.map(([k]) => k);
      for (const name of choice)
        if (!keys.includes(name))
          out.push(findingAt(file, site.at, { kind: "lack", name, addAt: labels.addAt, first: labels.first ? 1 : 0 }));
      labels.props.forEach(([name], i) => {
        if (name === "default" || choice.includes(name)) return;
        const { from, to } = dropRange(labels.props, i);
        out.push(findingAt(file, site.at, { kind: "extra", name, from, to }));
      });
    }
    return out;
  },
  fix: (f, { file, ast }) => {
    const kind = str(f.data, "kind");
    if (kind === "lack") {
      const name = str(f.data, "name");
      const at = num(f.data, "addAt");
      const text = `${num(f.data, "first") === 1 ? "" : ", "}${name}: ${JSON.stringify(name)}`;
      return [{ start: at, end: at, text }];
    }
    if (kind === "extra") return [{ start: num(f.data, "from"), end: num(f.data, "to"), text: "" }];
    const at = num(f.data, "element");
    return at < 0 ? null : dropThemeSelect(file.source, ast, at);
  },
};
