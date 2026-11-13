import { splitUrl } from "./splitUrl.ts";

/** The raw `next` search value of `url`, decoded, or `null` when it has none (`carriedNext` vets it). */
export function nextOf(url: string): string | null {
  return new URLSearchParams(splitUrl(url).query).get("next");
}
