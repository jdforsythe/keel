import { defect } from "@keel/schema";
import type { StoresFactory } from "../StoresFactory.ts";
import type { Made } from "./Made.ts";
import { isStore } from "./isStore.ts";
import { isTransaction } from "./isTransaction.ts";
import { isolated } from "./isolated.ts";

/**
 * Run `factory` in a detached scope with its own store registry, so a live store of the same id never collides, pass
 * what it made to `use`, then dispose the scope.
 */
export function withFactory<R>(factory: StoresFactory, use: (made: Made) => R): R {
  const out: R[] = [];
  isolated(() => {
    const values = Object.values(factory());
    out.push(use({ stores: values.filter(isStore), txs: values.filter(isTransaction) }));
  });
  const [r] = out;
  if (r === undefined) return defect("std.conflicts: the stores factory produced nothing");
  return r;
}
