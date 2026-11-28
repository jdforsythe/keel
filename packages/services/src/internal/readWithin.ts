import { type Result, err, ok } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";
import { fail } from "./fail.ts";

/**
 * The body of `res` as text when it is at most `limit` bytes: `api.decode` (rule `max`) when longer (reading stops past
 * `limit` and the body is cancelled), `api.network` when the body cannot be read.
 */
export async function readWithin(res: Response, limit: number): Promise<Result<string, ApiError<never>>> {
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    for (let part = await reader?.read(); part !== undefined && !part.done; part = await reader?.read()) {
      size += part.value.length;
      if (size > limit) {
        reader?.cancel().catch(() => undefined);
        return err(fail.decode([{ path: [], rule: "max" }]));
      }
      text += decoder.decode(part.value, { stream: true });
    }
  } catch {
    return err(fail.network());
  }
  return ok(text + decoder.decode());
}
