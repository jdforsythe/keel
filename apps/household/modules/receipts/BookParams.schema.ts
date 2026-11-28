import { s } from "@keel/schema";
import { AppLocale } from "./AppLocale.schema.ts";

export const BookParams = s.object({ locale: AppLocale });
