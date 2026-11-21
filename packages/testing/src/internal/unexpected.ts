import type { CaughtError } from "@keel/runtime-dom";
import { fail } from "./fail.ts";

/** A root-Boundary catch (runtime-dom `mount` `onError`) as a thrown error of its code naming where it surfaced. */
export function unexpected(error: CaughtError): Error {
  return fail(error.code, `at ${error.data.at}: ${error.message}`, error.data);
}
