import { messages } from "@keel/std-messages";
import { AppLocale } from "./AppLocale.schema.ts";

export const Direct = messages(AppLocale, { title: {} }, (locale) => import(`./Direct/${locale}.ts`));
