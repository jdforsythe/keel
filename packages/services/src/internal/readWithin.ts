import { type Result, err, ok } from "@keel/schema";

/**
 * The body of `res` as text when it is at most `limit` bytes: `err("over")` when longer (reading stops past `limit`
 * and the body is cancelled), `err("failed")` when the body cannot be read.
 */
export async function readWithin(res: Response, limit: number): Promise<Result<string, "over" | "failed">> {
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    for (let part = await reader?.read(); part !== undefined && !part.done; part = await reader?.read()) {
      size += part.value.length;
      if (size > limit) {
        reader?.cancel().catch(() => undefined);
        return err("over");
      }
      text += decoder.decode(part.value, { stream: true });
    }
  } catch {
    return err("failed");
  }
  return ok(text + decoder.decode());
}
