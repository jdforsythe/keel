import { AppLocale } from "./AppLocale.schema.ts";

/** The served locales, in declaration order, read from `AppLocale` itself. */
export const servedLocales: readonly AppLocale[] =
  AppLocale.node.kind === "enum"
    ? AppLocale.node.values.flatMap((v) => {
        const r = AppLocale.parse(v);
        return r.ok ? [r.value] : [];
      })
    : [];
