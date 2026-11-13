import axe from "axe-core";
import type { AxeOutcome } from "../src/internal/AxeOutcome.ts";
import { unsafe } from "./unsafe.ts";

interface RawNode {
  readonly node: { readonly element: Element } | null;
}
interface RawResult {
  readonly id: string;
  readonly result: string;
  readonly help: string;
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
  readonly _thisWillBeDeletedDoNotUse: { readonly base: { readonly Context: new (spec: Element | Document) => Ctx } };
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

/**
 * Run the axe-core rules named in `ids` over `root` synchronously: the steps of `axe.run` (context, each rule's
 * `runSync`, `after`, result metadata, verdicts) without its timers, so a harness render can fail as it returns.
 * A rule that throws, or whose verdict is `cantTell` (axe's `incomplete`), is not run.
 */
export function axeSync(root: Element | Document, ids: ReadonlySet<string>): AxeOutcome {
  return unsafe(
    "render() fails synchronously and axe.run resolves on setTimeout: replays axe-core 4.14.0 runRules via untyped internals",
    () => {
      const a = axe as unknown as Internals;
      const context = new a._thisWillBeDeletedDoNotUse.base.Context(root);
      a._tree = context.flatTree;
      a._selectorData = a.utils.getSelectorData(context.flatTree);
      a._selectCache = [];
      const options = {};
      try {
        const raw: object[] = [];
        for (const rule of a._audit.rules) {
          if (!ids.has(rule.id)) continue;
          try {
            raw.push(rule.runSync(context, options));
          } catch {
            // an async check or a rule error: no verdict, so not run
          }
        }
        const results = a._audit.after(raw, options).map((r) => {
          a.utils.publishMetaData(r);
          return a.utils.finalizeRuleResult(r);
        });
        const ran: string[] = [];
        const failed: { rule: string; help: string; elements: Element[] }[] = [];
        for (const r of results) {
          if (r.result === "cantTell") continue;
          ran.push(r.id);
          if (r.result !== "failed") continue;
          const elements = r.violations.flatMap((n) => (n.node === null ? [] : [n.node.element]));
          failed.push({ rule: r.id, help: r.help, elements });
        }
        return { ran, failed };
      } finally {
        a._selectCache = undefined;
        a.teardown();
      }
    },
  );
}
