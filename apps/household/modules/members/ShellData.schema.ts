import { s } from "@keel/schema";
import { line } from "@keel/std-text";
import { ShellText } from "./ShellText.schema.ts";

/** What a shell layout loads: the masthead's copy, the household's name (`null` before setup) and whether a member is signed in. */
export const ShellData = s.object({ text: ShellText, name: line({ max: 40 }).nullable(), signedIn: s.boolean() });
