import { s } from "@keel/schema";
import { messages } from "@keel/std-messages";
import { AppLocale } from "./AppLocale.schema.ts";

export const Demo = messages(
  AppLocale,
  { title: {}, count: { n: s.int({ min: 0 }) }, kind: { k: s.enum(["a", "b"]) } },
  (locale) => import(`./Demo/${locale}.ts`),
);
