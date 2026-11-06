import type { Verb } from "@keel/router";

const VERBS: readonly Verb[] = ["POST", "PUT", "PATCH", "DELETE"];

/** Whether `v` is an action verb (ADR-0005): `POST`, `PUT`, `PATCH`, `DELETE`. */
export function isVerb(v: string): v is Verb {
  return VERBS.some((x) => x === v);
}
