import { type KeelError, type Result, err } from "@keel/schema";

/** The `geo.unavailable` error result, with a one-line reason as its message. */
export function unavailable(why: string): Result<never, KeelError<"geo.unavailable", Record<string, never>>> {
  return err({ code: "geo.unavailable", message: why.slice(0, 89), data: {} });
}
