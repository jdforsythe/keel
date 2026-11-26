import { callable } from "../../unsafe/callable.ts";
import type { Contract } from "../contract/types/Contract.ts";
import type { Action } from "../types/Action.ts";
import type { ApiAction } from "../types/ApiAction.ts";
import type { ApiGuard } from "../types/ApiGuard.ts";
import type { Loader } from "../types/Loader.ts";
import type { Verb } from "../types/Verb.ts";
import type { Bound } from "./Bound.ts";
import type { Compiled } from "./Compiled.ts";
import type { Def } from "./Def.ts";
import type { EntryShape } from "./EntryShape.ts";
import type { Registered } from "./Registered.ts";
import { carriedFits } from "./carriedFits.ts";
import { checkEntries } from "./checkEntries.ts";
import { codedError } from "./codedError.ts";
import { isAction } from "./isAction.ts";
import { isGuard } from "./isGuard.ts";
import { isLoader } from "./isLoader.ts";
import { isStub } from "./isStub.ts";
import { locate } from "./locate.ts";
import { ownValue } from "./ownValue.ts";
import { shapesOf } from "./shapesOf.ts";
import { stubbed } from "./stubbed.ts";

const VERBS: readonly Verb[] = ["POST", "PUT", "PATCH", "DELETE"];
const VIEW = ["component", "loader", "guard", "layout"];
const ROWS = {
  page: [...VIEW, "errorElement", "title", ...VERBS],
  layout: [...VIEW, "errorElement"],
  read: ["loader", "guard"],
  write: ["action", "guard"],
} as const;

const rowOf = (s: EntryShape): keyof typeof ROWS =>
  s.kind === "api" ? (s.method === "GET" ? "read" : "write") : s.kind;

/** The loader bound at `s`, checked: declared for this contract and id, live exactly on an `events: true` GET (E1515). */
function loaderAt(c: Contract, s: EntryShape, v: unknown): Loader | undefined {
  if (v === undefined) return undefined;
  if (isStub(v)) return stubbed.loader(c, s.id, v);
  if (!isLoader(v) || v.contract !== c || v.id !== s.id)
    throw codedError(
      "E1515",
      `${s.id}: its loader is declared for ${isLoader(v) ? `${v.contract.module}'s ${v.id}` : "no entry"}`,
    );
  const live = typeof ownValue(v, "live") === "function";
  if (s.kind === "api" && s.events === true && !live)
    throw codedError("E1515", `${s.id}: an events entry's loader is an async generator`);
  if (live && !(s.kind === "api" && s.events === true))
    throw codedError("E1515", `${s.id}: only an events: true entry's loader is an async generator`);
  return v;
}

/** The action bound at `s` under `member`, checked: declared for this contract and id, of the entry's kind (E1515). */
function actionAt(c: Contract, s: EntryShape, member: string, v: unknown): Action | ApiAction | undefined {
  if (v === undefined) return undefined;
  if (isStub(v)) return stubbed.action(c, s.id, v);
  const api = s.kind === "api";
  if (!isAction(v) || v.contract !== c || v.id !== s.id || (ownValue(v, "output") !== undefined) !== api)
    throw codedError("E1515", `${s.id}: ${member} is not an action declared for ${s.id}`);
  return v;
}

/** The guard bound at `s`, checked: a guard (E1515), with a `redirect` on a page or layout (E1508). */
function guardAt(s: EntryShape, v: unknown): ApiGuard | undefined {
  if (v === undefined) return undefined;
  if (isStub(v)) return stubbed.guard(v);
  if (!isGuard(v)) throw codedError("E1515", `${s.id}: guard is no guard`);
  if (s.kind !== "api" && typeof v.redirect !== "string") throw codedError("E1508", `${s.id}: guard without redirect`);
  return v;
}

/**
 * Whether `layout` may be a binding's `layout` in module `module` (k.contract Binding): a layout id of its own
 * contract, or an id `<other>.<name>` of another module's contract, which `routeTable` resolves.
 */
function layoutFits(module: string, shapes: ReadonlyMap<string, EntryShape>, layout: unknown): boolean {
  if (typeof layout !== "string") return false;
  const dot = layout.indexOf(".");
  if (dot < 1 || dot === layout.length - 1) return false;
  return layout.slice(0, dot) === module ? shapes.get(layout)?.kind === "layout" : true;
}

/**
 * Bind `binding` to contract `c` (k.contract Binding) and compile one module's table. Throws an Error with `code`:
 * E1515 a key no entry of `c` has, an entry left unbound, a binding missing its required member (`component`,
 * `loader`, `action`) or a handler declared for another id or contract, a plain loader on an `events: true` entry or
 * an async generator one on any other; E1510 a member the entry's kind refuses; E1508 a page or layout guard without
 * `redirect`, a redirect to an API entry, or a guarded page whose chain carries a param its redirect route of `c`
 * declares that the page lacks or whose node does not fit (`carriedFits`); E1506 a `layout` of `c`'s module that is no layout id of `c`, one not
 * of the form `<module>.<name>`, or a cycle within `c`. A `layout` of another module's contract leaves the table
 * `open` until `routeTable` joins it.
 */
export function bindTable(c: Contract, binding: unknown): Compiled {
  if (typeof c !== "object" || c === null || c.kind !== "keel.contract")
    throw codedError("E1515", "manifest: the first argument is no contract");
  const shapes = shapesOf.get(c) ?? checkEntries(c.module, c.entries);
  if (typeof binding !== "object" || binding === null)
    throw codedError("E1515", `${c.module}: the binding is an object`);
  for (const k of Object.keys(binding))
    if (!shapes.has(k)) throw codedError("E1515", `${k}: no entry of contract ${c.module} has this id`);
  const defs = new Map<string, Def>();
  const bindings = new Map<string, Bound>();
  for (const [id, s] of shapes) {
    const b = ownValue(binding, id);
    if (b === undefined) throw codedError("E1515", `${id}: not bound`);
    if (typeof b !== "object" || b === null) throw codedError("E1515", `${id}: its binding is an object`);
    const row: readonly string[] = ROWS[rowOf(s)];
    const bad = Object.keys(b).find((k) => !row.includes(k));
    if (bad !== undefined) throw codedError("E1510", `${id}: a ${rowOf(s)} binding takes no "${bad}"`);
    const at = (k: string): unknown => ownValue(b, k);
    const required = s.kind === "api" ? (s.method === "GET" ? "loader" : "action") : "component";
    if (at(required) === undefined) throw codedError("E1515", `${id}: binds no ${required}`);
    const component = at("component");
    const errorElement = at("errorElement");
    const title = at("title");
    for (const [k, v] of [
      ["component", component],
      ["errorElement", errorElement],
      ["title", title],
    ] as const)
      if (v !== undefined && typeof v !== "function") throw codedError("E1515", `${id}: ${k} is a function`);
    const layout = at("layout");
    if (layout !== undefined && !layoutFits(c.module, shapes, layout))
      throw codedError("E1506", `${id}: layout ${JSON.stringify(layout)} is no layout of contract ${c.module}`);
    const loader = loaderAt(c, s, at("loader"));
    const guard = guardAt(s, at("guard"));
    const actions: Partial<Record<Verb, Action | ApiAction>> = {};
    if (s.kind === "api" && s.method !== undefined && s.method !== "GET") {
      const a = actionAt(c, s, "action", at("action"));
      if (a !== undefined) actions[s.method] = a;
    }
    for (const v of VERBS) {
      const a = s.kind === "page" ? actionAt(c, s, v, at(v)) : undefined;
      if (a !== undefined) actions[v] = a;
    }
    const view = callable<NonNullable<Def["component"]>>(component);
    const shown = callable<NonNullable<Def["errorElement"]>>(errorElement);
    const titled = callable<NonNullable<Def["title"]>>(title);
    defs.set(id, {
      ...s,
      contract: c,
      actions: Object.freeze(actions),
      ...(typeof layout === "string" ? { layout } : {}),
      ...(guard === undefined ? {} : { guard }),
      ...(loader === undefined ? {} : { loader }),
      ...(view === undefined ? {} : { component: view }),
      ...(shown === undefined ? {} : { errorElement: shown }),
      ...(titled === undefined ? {} : { title: titled }),
    });
    bindings.set(id, Object.freeze({ contract: c, entry: Object(c.entries[id]), binding: Object.freeze({ ...b }) }));
  }
  for (const d of defs.values()) {
    const to = d.guard?.redirect;
    // A redirect is a page of this contract (k.guards); an API entry has no page to go to.
    if (to !== undefined && defs.get(to)?.kind === "api")
      throw codedError("E1508", `${d.id}: guard redirect to an API entry`);
  }
  const table = new Map<string, Registered>();
  for (const [id, def] of defs) table.set(id, { id, def, segments: def.segments });
  const located = locate(table, c.module);
  carriedFits(located.located, defs);
  return { bindings, table, ...located };
}
