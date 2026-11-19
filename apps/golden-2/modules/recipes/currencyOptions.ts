import { Currency } from "@keel/std-money";

/** The currencies a recipe's price can be in, in declaration order, read from `Currency` itself. */
export const currencyOptions: readonly Currency[] =
  Currency.node.kind === "enum"
    ? Currency.node.values.flatMap((v) => {
        const r = Currency.parse(v);
        return r.ok ? [r.value] : [];
      })
    : [];
