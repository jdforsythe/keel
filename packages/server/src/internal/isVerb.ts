import type { Verb } from "@keel/router";

/** Whether `v` is an action verb (ADR-0005): `POST`, `PUT`, `PATCH`, `DELETE`. */
export function isVerb(v: string): v is Verb {
  return v === "POST" || v === "PUT" || v === "PATCH" || v === "DELETE";
}
