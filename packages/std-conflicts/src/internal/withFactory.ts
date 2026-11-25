import { owner, scope } from "@keel/reactive";
import { isolate } from "@keel/store";
import { raise } from "../../unsafe/raise.ts";
import type { StoresFactory } from "../StoresFactory.ts";
import type { Made } from "./Made.ts";
import { isStore } from "./isStore.ts";
import { isTransaction } from "./isTransaction.ts";

/**
 * Run `factory` in a detached scope with its own store registry, so a live store of the same id never collides, pass
 * what it made to `use`, then dispose the scope.
 */
export function withFactory<R>(factory: StoresFactory, use: (made: Made) => R): R {
  const out: R[] = [];
  const sc = scope(
    () => {
      const own = owner();
      if (own !== undefined) isolate(own);
      const values = Object.values(factory());
      out.push(use({ stores: values.filter(isStore), txs: values.filter(isTransaction) }));
    },
    { detached: true },
  );
  sc.dispose();
  const [r] = out;
  if (r === undefined) return raise("std.conflicts: the stores factory produced nothing");
  return r;
}
