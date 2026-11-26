import type { Assembled } from "./Assembled.ts";
import { GROUP_ORDER } from "./GROUP_ORDER.ts";
import type { Val } from "./Val.ts";
import { keyText } from "./keyText.ts";

const val = (v: Val): string =>
  typeof v === "string" ? JSON.stringify(v) : `{ light: ${JSON.stringify(v.light)}, dark: ${JSON.stringify(v.dark)} }`;
const lines = (entries: ReadonlyMap<string, string>, indent: string): string =>
  [...entries].map(([k, v]) => `${indent}${keyText(k)}: ${v},\n`).join("");

const WIDTH = 120;
/** `  name: { k: v, ... },` on one line when it fits the repository's line width, else one entry to a line. */
const block = (name: string, entries: ReadonlyMap<string, string>): string => {
  const one = `  ${name}: { ${[...entries].map(([k, v]) => `${keyText(k)}: ${v}`).join(", ")} },\n`;
  return one.length <= WIDTH ? one : `  ${name}: {\n${lines(entries, "    ")}  },\n`;
};

/** The text of `tokens.design.ts` for `a`: the generated-file line, then `export const designTokens = defineTokens({...})`. */
export function renderDesignTokens(a: Assembled): string {
  const body: string[] = [];
  for (const group of GROUP_ORDER) {
    const g = a.groups.get(group);
    if (g === undefined || g.size === 0) continue;
    body.push(block(group, new Map([...g].map(([k, v]) => [k, val(v)]))));
  }
  if (a.looks.size > 0) {
    const entries = new Map(
      [...a.looks].map(([k, v]) => [
        k,
        `{ ${Object.entries(v)
          .map(([f, n]) => `${f}: ${JSON.stringify(n)}`)
          .join(", ")} }`,
      ]),
    );
    body.push(block("look", entries));
  }
  if (a.themes.size > 0) {
    const themes: string[] = [];
    for (const [name, t] of a.themes) {
      const inner = [
        ...(t.when === undefined ? [] : [`      when: ${JSON.stringify(t.when)},\n`]),
        ...[...t.groups].map(
          ([g, names]) =>
            `      ${keyText(g)}: {\n${lines(new Map([...names].map(([k, v]) => [k, JSON.stringify(v)])), "        ")}      },\n`,
        ),
      ];
      themes.push(`    ${keyText(name)}: {\n${inner.join("")}    },\n`);
    }
    body.push(`  themes: {\n${themes.join("")}  },\n`);
  }
  return [
    "// Written by keel tokens import; edit tokens.ts.\n",
    'import { defineTokens } from "@keel/ui";\n\n',
    `export const designTokens = defineTokens({\n${body.join("")}});\n`,
  ].join("");
}
