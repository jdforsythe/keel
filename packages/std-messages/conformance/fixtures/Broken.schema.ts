import { messages } from "@keel/std-messages";
import { AppLocale } from "./AppLocale.schema.ts";

export const Broken = messages(AppLocale, { title: {} }, (locale) => import(`./Broken/${locale}.ts`));
