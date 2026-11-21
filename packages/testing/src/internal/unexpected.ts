import type { CaughtError } from "@keel/runtime-dom";
import { fail } from "./fail.ts";

/**
 * A root-Boundary catch (runtime-dom `mount` `onError`, or a router's root alert) as a thrown error of its code naming
 * where it surfaced, when it has a place.
 */
export function unexpected(error: CaughtError): Error {
  const where = error.data.at === "" ? "" : `at ${error.data.at}: `;
  return fail(error.code, `${where}${error.message}`, error.data);
}
