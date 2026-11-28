import axe from "axe-core";
import { axeInternals } from "../../unsafe/axeSync.ts";
import type { AxeOutcome } from "./AxeOutcome.ts";

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
  const a = axeInternals(axe);
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
