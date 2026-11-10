import type { Expression } from "oxc-parser";
import { placeholders } from "../../internal/placeholders.ts";
import type { Hit } from "./Hit.ts";
import type { ToolKind } from "./ToolKind.ts";
import { clip } from "./clip.ts";
import { keyOf } from "./keyOf.ts";
import { stringOf } from "./stringOf.ts";
import { unwrap } from "./unwrap.ts";

const FORMS = ["zero", "one", "two", "few", "many", "other"];

/**
 * E2405 hits for the message of `key` (declared `params`): a `{name}` that is not a param (with a rename edit when
 * exactly one declared param is absent from that template), a brace outside a placeholder, a `plural` over a param
 * that is not a number, a `select` over one that is not an enum, and a `select` whose cases differ from its values.
 */
export function paramHits(key: string, value: Expression, params: ReadonlyMap<string, ToolKind>): Hit[] {
  const out: Hit[] = [];
  const k = clip(key);
  const tmpl = (e: Expression, p?: string): void => {
    const s = stringOf(e);
    if (s === undefined) return;
    const ph = placeholders(s.raw);
    if (ph === undefined) {
      out.push({ at: s.at, msg: `message '${k}' has a brace outside a {param} placeholder` });
      return;
    }
    const used = new Set(ph.map((x) => x.name));
    const absent = [...params.keys()].filter((n) => !used.has(n) && !(n === p && s.raw.includes("#")));
    for (const x of ph) {
      if (params.has(x.name)) continue;
      const at = s.at + x.start + 1;
      const to = absent.length === 1 ? absent[0] : undefined;
      const msg = `{${clip(x.name)}} is not a param of '${k}'`;
      out.push(to === undefined ? { at, msg } : { at, msg, edit: { start: at, end: s.at + x.end - 1, text: to } });
    }
  };
  const x = unwrap(value);
  if (x.type !== "ObjectExpression") {
    tmpl(x);
    return out;
  }
  const fields = new Map(x.properties.flatMap((p) => (p.type === "Property" ? [[keyOf(p) ?? "", p.value]] : [])));
  const text = fields.get("text");
  if (text !== undefined) tmpl(text);
  const pluralOn = fields.get("plural");
  const plural = pluralOn === undefined ? undefined : stringOf(pluralOn);
  if (plural !== undefined) {
    const kind = params.get(plural.value);
    if (kind !== "number" && kind !== "unknown")
      out.push({ at: plural.at, msg: `plural '${clip(plural.value)}' is not a number param of '${k}'` });
    for (const f of FORMS) {
      const form = fields.get(f);
      if (form !== undefined) tmpl(form, plural.value);
    }
  }
  const selectOn = fields.get("select");
  const select = selectOn === undefined ? undefined : stringOf(selectOn);
  if (select === undefined) return out;
  const kind = params.get(select.value);
  if (typeof kind !== "object" && kind !== "unknown")
    out.push({ at: select.at, msg: `select '${clip(select.value)}' is not an enum param of '${k}'` });
  const casesOn = fields.get("cases");
  const cases = casesOn === undefined ? undefined : unwrap(casesOn);
  if (cases?.type !== "ObjectExpression") return out;
  const seen = new Set<string>();
  for (const c of cases.properties) {
    const name = keyOf(c);
    if (name === undefined || c.type !== "Property") continue;
    seen.add(name);
    if (typeof kind === "object" && !kind.includes(name))
      out.push({ at: c.start, msg: `case '${clip(name)}' is not a value of '${clip(select.value)}'` });
    tmpl(c.value);
  }
  if (typeof kind === "object")
    for (const v of kind)
      if (!seen.has(v)) out.push({ at: cases.start, msg: `select of '${k}' lacks case '${clip(v)}'` });
  return out;
}
