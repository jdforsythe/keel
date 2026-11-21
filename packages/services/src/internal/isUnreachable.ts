import { readJson } from "./readJson.ts";
import { readWithin } from "./readWithin.ts";
import { unreachable } from "./unreachable.ts";

const LIMIT = 1024;

/** Whether a 502 `res` is a JSON `keel.unreachable` err of at most 1 KiB; reads a clone, at most 1,025 bytes of it. */
export async function isUnreachable(res: Response): Promise<boolean> {
  if (!/json/i.test(res.headers.get("content-type") ?? "") || Number(res.headers.get("content-length")) > LIMIT) {
    return false;
  }
  const text = await readWithin(res.clone(), LIMIT);
  const json = text.ok ? readJson(text.value) : undefined;
  return json?.ok === true && unreachable.parse(json.value).ok;
}
