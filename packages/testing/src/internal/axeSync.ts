import axe from "axe-core";
import type { AxeOutcome } from "./AxeOutcome.ts";

interface RawNode {
  readonly node: { readonly element: Element } | null;
}
interface RawResult {
  readonly id: string;
  readonly result: string;
  readonly help: string;
  /** Set by `after` when the rule's aggregation threw (`createIncompleteErrorResult`). */
  readonly error?: unknown;
  /** The failed nodes, grouped by `finalizeRuleResult`. */
  readonly violations: readonly RawNode[];
}
interface Rule {
  readonly id: string;
  runSync(context: object, options: object): object;
}
interface Audit {
  readonly rules: readonly Rule[];
  after(results: readonly object[], options: object): object[];
}
interface Internals {
  readonly _audit: Audit;
  _tree: unknown;
  _selectorData: unknown;
  _selectCache: unknown;
  readonly _thisWillBeDeletedDoNotUse: {
    readonly base: {
      readonly Context: new (spec: Element | Document | { include: unknown[]; exclude: unknown[] }) => Ctx;
    };
  };
  readonly utils: {
    getSelectorData(tree: unknown): unknown;
    publishMetaData(result: object): void;
    finalizeRuleResult(result: object): RawResult;
  };
  teardown(): void;
}
interface Ctx {
  readonly flatTree: unknown;
}

const isObject = (v: unknown): v is object => (typeof v === "object" || typeof v === "function") && v !== null;

/**
 * Whether `x` holds every member of `Internals` this file calls or sets, as axe-core 4.14.0 (pinned in package.json)
 * does: the rule list and `after`, the Context constructor, the three utilities and `teardown`. The members' own
 * signatures are axe's; the a11y tests run every rule through them.
 */
function isInternals(x: unknown): x is Internals {
  if (!isObject(x) || !("_audit" in x && "utils" in x && "_thisWillBeDeletedDoNotUse" in x && "teardown" in x))
    return false;
  const { _audit: audit, utils, _thisWillBeDeletedDoNotUse: hidden } = x;
  if (!isObject(audit) || !("rules" in audit && "after" in audit)) return false;
  if (!isObject(utils) || !("getSelectorData" in utils && "publishMetaData" in utils && "finalizeRuleResult" in utils))
    return false;
  if (!isObject(hidden) || !("base" in hidden) || !isObject(hidden.base) || !("Context" in hidden.base)) return false;
  return (
    Array.isArray(audit.rules) &&
    typeof audit.after === "function" &&
    typeof hidden.base.Context === "function" &&
    typeof utils.getSelectorData === "function" &&
    typeof utils.publishMetaData === "function" &&
    typeof utils.finalizeRuleResult === "function" &&
    typeof x.teardown === "function"
  );
}

/**
 * Run the axe-core rules named in `ids` over `root` synchronously: the steps of `axe.run` (context, each rule's
 * `runSync`, `after`, result metadata, verdicts) without its timers, so a harness render can fail as it returns.
 * A rule whose verdict is `cantTell` (axe's `incomplete`) is not run; a rule that throws, or whose `after` failed, is
 * `broken`, with its error's first line. Elements in `exclude` (another open harness's page) are not judged.
 */
export function axeSync(
  root: Element | Document,
  ids: ReadonlySet<string>,
  exclude: readonly Element[] = [],
): AxeOutcome {
  const a: unknown = axe;
  if (!isInternals(a)) throw new Error("axe-core's internals are not those of 4.14.0, which @keel/testing runs");
  const context = new a._thisWillBeDeletedDoNotUse.base.Context(
    exclude.length === 0 ? root : { include: [root], exclude: [...exclude] },
  );
  a._tree = context.flatTree;
  a._selectorData = a.utils.getSelectorData(context.flatTree);
  a._selectCache = [];
  const options = {};
  try {
    const raw: object[] = [];
    const broken: { rule: string; message: string }[] = [];
    for (const rule of a._audit.rules) {
      if (!ids.has(rule.id)) continue;
      try {
        raw.push(rule.runSync(context, options));
      } catch (error) {
        broken.push({
          rule: rule.id,
          message: String(error instanceof Error ? error.message : error).split("\n")[0] ?? "",
        });
      }
    }
    const results = a._audit.after(raw, options).map((r) => {
      a.utils.publishMetaData(r);
      return a.utils.finalizeRuleResult(r);
    });
    const ran: string[] = [];
    const failed: { rule: string; help: string; elements: Element[] }[] = [];
    for (const r of results) {
      if (r.error !== undefined) broken.push({ rule: r.id, message: String(r.error) });
      if (r.error !== undefined || r.result === "cantTell") continue;
      ran.push(r.id);
      if (r.result !== "failed") continue;
      const elements = r.violations.flatMap((n) => (n.node === null ? [] : [n.node.element]));
      failed.push({ rule: r.id, help: r.help, elements });
    }
    return { ran, failed, broken };
  } finally {
    a._selectCache = undefined;
    a.teardown();
  }
}
