import type { Argument, Expression, ObjectProperty } from "oxc-parser";
import { unwrapExpression } from "../globals/unwrapExpression.ts";
import type { ContractEntryReading } from "./ContractEntryReading.ts";
import type { ContractGap } from "./ContractGap.ts";
import type { Literal } from "./Literal.ts";
import { keyOf } from "./keyOf.ts";
import { literalOf } from "./literalOf.ts";

/** The members whose value must be a literal written in place (k.contract Static reading). */
const LITERAL_MEMBERS = ["method", "path", "layout", "events"] as const;

/** Whether `l` is a value member `name` may hold: `method` a string; `path` a string or none; the others any. */
function fits(name: string, l: Literal): boolean {
  if (name === "method") return typeof l.value === "string";
  if (name === "path") return typeof l.value === "string" || l.value === null;
  return true;
}

const gap = (part: ContractGap["part"], id: string | null, at: { start: number; end: number }): ContractGap => ({
  kind: "gap",
  part,
  id,
  start: at.start,
  end: at.end,
});

/** Entry `id` read from its object literal `value` (`readContract`). */
function readEntry(id: string, prop: ObjectProperty, value: Expression): ContractEntryReading | ContractGap {
  const obj = unwrapExpression(value);
  if (obj.type !== "ObjectExpression") return gap("entry", id, value);
  const members = new Map<string, ObjectProperty>();
  const literals = new Map<string, string | boolean | null>();
  const gaps: ContractGap[] = [];
  for (const p of obj.properties) {
    const name = p.type === "Property" ? keyOf(p) : null;
    if (p.type !== "Property") gaps.push(gap("spread", id, p));
    else if (name === null) gaps.push(gap("key", id, p));
    else members.set(name, p);
  }
  for (const name of LITERAL_MEMBERS) {
    const e = members.get(name)?.value;
    if (e === undefined) continue;
    const l = literalOf(e);
    if (l !== undefined && fits(name, l)) literals.set(name, l.value);
    else gaps.push(gap(name, id, e));
  }
  gaps.sort((a, b) => a.start - b.start);
  return { kind: "entry", id, prop, members, literals, gaps };
}

/**
 * The static reading of a `contract(id, entries)` call's `entries` argument (k.contract Static reading), shared by
 * the compiler's `routes.json` reader (W1005) and `keel check`'s E1111 so both read a contract one way: in source
 * order, each entry written as an object literal under a literal key (`ContractEntryReading`), and each part not read
 * (`ContractGap`). Nothing is followed but what an entry's members name: the entries and each entry are object
 * literals in the call, so a name, a call or a spread there, even of a const object literal, is a gap at it and the
 * entries beside it are still read; `method`, `path`, `layout` and `events` are literals written in place. Schemas
 * (`params`, `search`, `query`) are left to the caller to follow.
 */
export function readContract(entries: Argument): readonly (ContractEntryReading | ContractGap)[] {
  const table = entries.type === "SpreadElement" ? entries : unwrapExpression(entries);
  if (table.type !== "ObjectExpression") return [gap("entries", null, entries)];
  const out: (ContractEntryReading | ContractGap)[] = [];
  for (const p of table.properties) {
    const id = p.type === "Property" ? keyOf(p) : null;
    if (p.type !== "Property") out.push(gap("spread", null, p));
    else if (id === null) out.push(gap("key", null, p));
    else out.push(readEntry(id, p, p.value));
  }
  return out;
}
