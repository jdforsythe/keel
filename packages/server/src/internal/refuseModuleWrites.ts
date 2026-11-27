import { moduleWrites as nodeWrites } from "@keel/reactive/internal";
import { defect } from "@keel/schema";
import { moduleWrites } from "@keel/store/internal";
import { serving } from "./serving.ts";

/** The E1256 defect (k.shared): `node` the written node's `inspect` id, or a module store's id. */
const refused = (node: number | string, kind: "signal" | "root" | "store"): never =>
  defect("write to module state during a request", "E1256", { data: { node, kind } });

/**
 * Refuses a write to module state while a request or work it scheduled runs (`serving`, which follows async context,
 * not data), changing nothing (k.shared, k.leave Module stores): a `set` on a signal a module root owns (kind
 * `signal`), a module root's `run`, which a maker making its state there on first use calls (kind `root`), and `tx`,
 * `restore`, `undo` and `undoWhere` on a module-registry store (kind `store`) each raise the E1256 defect. Each
 * `createApp` calls it, so the checks are installed again after another took the slots; a browser installs none.
 */
export function refuseModuleWrites(): void {
  nodeWrites.check = (node, kind) => {
    if (serving.getStore()) refused(node, kind);
  };
  moduleWrites.check = (id) => {
    if (serving.getStore()) refused(id, "store");
  };
}
