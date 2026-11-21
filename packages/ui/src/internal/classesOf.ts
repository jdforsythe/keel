import type { PartState } from "../aria/PartState.ts";
import { className } from "./className.ts";
import { isReadable } from "./isReadable.ts";
import { isRecord } from "./isRecord.ts";
import { readToken } from "./readToken.ts";
import { states } from "./states.ts";
import { styleProps } from "./styleProps.ts";

/** An atomic class `className` produces (`k-p-2`, `k-md-hover-bg-accent`, `k-p-x_1a2b3c4d`). */
const ATOMIC = /^k-[A-Za-z0-9_-]+$/;

const breakpointsOf = (v: Readonly<Record<string, unknown>>): string[] =>
  Object.keys(v).sort((a, b) => (a === "base" ? -1 : b === "base" ? 1 : a < b ? -1 : a > b ? 1 : 0));

function collect(src: Readonly<Record<string, unknown>>, state: PartState | undefined, out: string[]): void {
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

/**
 * The atomic classes for an element's style props, then its `states`, then the classes the compiler lowered its
 * static style props to (k.compiler: `class: "k-p-2 ..."`, the props themselves dropped). That lowered `class` is in no
 * element's type (rfc:0043), and only atomic `k-` classes are kept from it, so it is no way around tokens. Reads
 * signals (tracked).
 */
export function classesOf(props: Readonly<Record<string, unknown>>): string[] {
  const out: string[] = [];
  collect(props, undefined, out);
  const st = props.states;
  if (isRecord(st))
    for (const s of states) {
      const nested = st[s.key];
      if (isRecord(nested) && !isReadable(nested)) collect(nested, s.key, out);
    }
  const lowered = props.class;
  if (typeof lowered === "string")
    for (const c of lowered.split(/\s+/)) if (ATOMIC.test(c) && !out.includes(c)) out.push(c);
  return out;
}
