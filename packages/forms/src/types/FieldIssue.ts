import type { SchemaError } from "@keel/schema";

/**
 * One field issue as `issueText` receives it (k.forms Validation): the rule, the dotted field path (the key of
 * `errors()`), and the constraint from the schema node at the path: string length or number bounds, enum or literal
 * `values`, and `format`, the format type's name.
 */
export type FieldIssue = {
  readonly rule: SchemaError["data"]["issues"][number]["rule"];
  readonly path: string;
  readonly min?: number;
  readonly max?: number;
  readonly values?: readonly (string | number | boolean)[];
  readonly format?: string;
};
