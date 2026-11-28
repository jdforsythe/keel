import type { Assembled } from "./Assembled.ts";
import type { DesignFile } from "./DesignFile.ts";
import type { FileConversion } from "./FileConversion.ts";
import type { Val } from "./Val.ts";
import { convertFile } from "./convertFile.ts";
import { lowerCamel } from "./lowerCamel.ts";
import { themeWhen } from "./themeWhen.ts";

const mapOf = (c: FileConversion): Map<string, Map<string, string>> => {
  const groups = new Map<string, Map<string, string>>();
  for (const i of c.items) groups.set(i.group, (groups.get(i.group) ?? new Map()).set(i.name, i.value));
  return groups;
};

/** The base values of a collection holding `light` and `dark`: a color that differs is a pair, any other token takes `light`'s value. */
function pairs(light: FileConversion, dark: FileConversion): Map<string, Map<string, Val>> {
  const l = mapOf(light);
  const d = mapOf(dark);
  const out = new Map<string, Map<string, Val>>();
  for (const group of new Set([...l.keys(), ...d.keys()])) {
    const names = new Map<string, Val>();
    const lg = l.get(group);
    const dg = d.get(group);
    for (const name of new Set([...(lg?.keys() ?? []), ...(dg?.keys() ?? [])])) {
      const lv = lg?.get(name);
      const dv = dg?.get(name);
      if (lv !== undefined && dv !== undefined && lv !== dv && group === "color")
        names.set(name, { light: lv, dark: dv });
      else names.set(name, lv ?? dv ?? "");
    }
    out.set(group, names);
  }
  return out;
}

/**
 * The files of a `keel tokens import` as the tokens, looks and themes `tokens.design.ts` holds (k.cli Tokens). Files
 * `<stem>.<mode>.tokens.json` make a collection of that stem, each other file a collection of its own. In a
 * collection `light` and `dark`, both given, are the pairs and every other mode a theme; else the first mode given
 * is the top level and each further one a theme.
 */
export function assemble(files: readonly DesignFile[]): Assembled {
  const out: Assembled = { groups: new Map(), looks: new Map(), themes: new Map(), warns: [] };
  const claimed = new Map<string, Set<string>>();
  const collections = new Map<string, number[]>();
  files.forEach((f, i) => {
    const key = f.mode === undefined ? `#${i}` : `${f.stem}`;
    collections.set(key, [...(collections.get(key) ?? []), i]);
  });
  for (const members of collections.values()) {
    const converted = members.map((i) => convertFile(files, i, claimed));
    members.forEach((file, k) => {
      for (const w of converted[k]?.warns ?? []) out.warns.push({ file, ...w });
    });
    const modeOf = (k: number): string => (files[members[k] ?? 0]?.mode ?? "").toLowerCase();
    const lightAt = members.findIndex((_, k) => modeOf(k) === "light");
    const darkAt = members.findIndex((_, k) => modeOf(k) === "dark");
    const light = converted[lightAt];
    const dark = converted[darkAt];
    const paired = light !== undefined && dark !== undefined;
    const rest = members.map((_, k) => k).filter((k) => !paired || (k !== lightAt && k !== darkAt));
    const baseAt = paired ? undefined : rest[0];
    const base = paired ? pairs(light, dark) : mapOf(converted[baseAt ?? -1] ?? { items: [], looks: [], warns: [] });
    const top = paired ? light : converted[baseAt ?? -1];
    for (const [group, names] of base) {
      const into = out.groups.get(group) ?? new Map<string, Val>();
      for (const [name, v] of names) into.set(name, v);
      out.groups.set(group, into);
    }
    for (const l of top?.looks ?? []) out.looks.set(l.name, l.value);
    for (const k of rest.filter((x) => x !== baseAt)) {
      const mode = files[members[k] ?? 0]?.mode ?? "";
      const name = lowerCamel([mode]);
      if (name === "") continue;
      const theme = out.themes.get(name) ?? { groups: new Map<string, Map<string, string>>() };
      const when = themeWhen(mode);
      if (when !== undefined && theme.when === undefined) theme.when = when;
      for (const [group, names] of mapOf(converted[k] ?? { items: [], looks: [], warns: [] })) {
        const into = theme.groups.get(group) ?? new Map<string, string>();
        for (const [n, v] of names) if (base.get(group)?.get(n) !== v) into.set(n, v);
        if (into.size > 0) theme.groups.set(group, into);
      }
      out.themes.set(name, theme);
    }
    for (const c of converted) {
      for (const i of c.items) claimed.set(i.group, (claimed.get(i.group) ?? new Set()).add(i.name));
      for (const l of c.looks) claimed.set("look", (claimed.get("look") ?? new Set()).add(l.name));
    }
  }
  return out;
}
