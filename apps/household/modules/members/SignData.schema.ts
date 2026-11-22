import { s } from "@keel/schema";
import { SignText } from "./SignText.schema.ts";

/** What the sign-in and sign-up pages load: their copy. */
export const SignData = s.object({ text: SignText });
