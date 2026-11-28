import type { Io } from "@keel/cli";

/** Fetch `url` as JSON through `io.fetch`; a failure (unreachable, non-2xx, not JSON) as a reason string. */
export async function getJson(
  io: Io & { fetch: NonNullable<Io["fetch"]> },
  url: string,
  init?: RequestInit,
): Promise<{ readonly ok: true; readonly body: unknown } | { readonly ok: false; readonly why: string }> {
  let res: Response;
  try {
    res = await io.fetch(url, init);
  } catch {
    return { ok: false, why: "target unreachable" };
  }
  if (!res.ok) return { ok: false, why: `target answered ${res.status}` };
  try {
    const body: unknown = await res.json();
    return { ok: true, body };
  } catch {
    return { ok: false, why: "not JSON" };
  }
}
