import type { UnexpectedError } from "@keel/runtime-dom";
import { fail } from "./fail.ts";

/** A root-Boundary catch (runtime-dom `mount` `onError`) as a thrown `keel.unexpected` error naming where it surfaced. */
export function unexpected(error: UnexpectedError): Error {
  return fail("keel.unexpected", `at ${error.data.at}: ${error.message}`, error.data);
}
