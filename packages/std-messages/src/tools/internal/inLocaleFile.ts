import type { RuleInput } from "@keel/check";
import type { ObjectExpression, ObjectProperty } from "oxc-parser";
import type { SetDecl } from "./SetDecl.ts";
import { dependsOn } from "./dependsOn.ts";
import { entryOf } from "./entryOf.ts";
import { localeFileOf } from "./localeFileOf.ts";

/** For a locale file of a module that lists the package: its set, locale and entry object; else `undefined`. */
export function inLocaleFile({ file, ast, project }: RuleInput):
  | {
      readonly set: SetDecl;
      readonly locale: string;
      readonly obj: ObjectExpression;
      readonly props: readonly { readonly name: string; readonly index: number; readonly prop: ObjectProperty }[];
    }
  | undefined {
  if (!dependsOn(file.path, project)) return undefined;
  const lf = localeFileOf(file.path, project);
  const entry = lf === undefined ? undefined : entryOf(ast, lf.set.name);
  return lf === undefined || entry === undefined ? undefined : { ...lf, ...entry };
}
