import type { Located } from "@keel/router/internal";
import { type ChainLevel, storeIdClashes } from "@keel/store/internal";
import { codedError } from "./codedError.ts";

/**
 * E1550 (k.server Rules): throw when two different `stores` factories the loaders of one route chain of `table` name
 * create one store id (`storeIdClashes`, each factory run once on a sim ctx), naming the first such pair.
 */
export function chainClash(table: readonly Located[]): void {
  const chains = table.map((r) =>
    r.chain.flatMap((l): ChainLevel[] => {
      const factory = l.def.loader?.stores;
      return factory === undefined ? [] : [{ route: l.id, name: factory.name, factory }];
    }),
  );
  const first = storeIdClashes(chains)[0];
  if (first !== undefined) throw codedError("E1550", first);
}
