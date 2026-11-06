import type { StyleState } from "../types/StyleState.ts";
import { className } from "./className.ts";
import { isReadable } from "./isReadable.ts";
import { isRecord } from "./isRecord.ts";
import { readToken } from "./readToken.ts";
import { states } from "./states.ts";
import { styleProps } from "./styleProps.ts";

const breakpointsOf = (v: Readonly<Record<string, unknown>>): string[] =>
  Object.keys(v).sort((a, b) => (a === "base" ? -1 : b === "base" ? 1 : a < b ? -1 : a > b ? 1 : 0));

function collect(src: Readonly<Record<string, unknown>>, state: StyleState | undefined, out: string[]): void {
  for (const prop of styleProps) {
    const v = src[prop];
    if (v === undefined) continue;
    if (isRecord(v) && !isReadable(v)) {
      for (const bp of breakpointsOf(v)) {
        const token = readToken(v[bp]);
        if (token !== undefined) out.push(className(prop, token, bp === "base" ? undefined : bp, state));
      }
    } else {
      const token = readToken(v);
      if (token !== undefined) out.push(className(prop, token, undefined, state));
    }
  }
}

/** The atomic classes for an element's style props, then its `class` prop. Reads signals (tracked). */
export function classesOf(props: Readonly<Record<string, unknown>>): string[] {
  const out: string[] = [];
  collect(props, undefined, out);
  for (const s of states) {
    const nested = props[s.key];
    if (isRecord(nested) && !isReadable(nested)) collect(nested, s.key, out);
  }
  const extra = props.class;
  if (typeof extra === "string") for (const c of extra.split(/\s+/)) if (c !== "") out.push(c);
  return out;
}
