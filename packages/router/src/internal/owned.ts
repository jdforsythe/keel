import { type KeelError, type Result, err } from "@keel/schema";
import { thrownAs } from "./thrownAs.ts";

/**
 * Run a guard's, a loader's or an action's `fn` as the owner that reports what it throws (k.errors, k.defects Where it
 * goes): the `Result` it answers, or for any throw or rejection, a defect among them, the `keel.unexpected` of
 * `thrownAs`, which the router shows at the nearest `errorElement` or Form. Never rejects.
 */
export async function owned<T, E extends KeelError<string, unknown>>(
  fn: () => Promise<Result<T, E>>,
): Promise<Result<T, E | KeelError<"keel.unexpected", { readonly cause: string }>>> {
  try {
    return await fn();
  } catch (thrown) {
    return err(thrownAs(thrown));
  }
}
