import type { Gen } from "./Gen.ts";
import { isRecord } from "./isRecord.ts";

/** `servers[0].url` when it is an absolute http(s) URL; else an issue and undefined. */
export function serverUrl(g: Gen): string | undefined {
  const first = Array.isArray(g.doc.servers) ? g.doc.servers[0] : undefined;
  const url = isRecord(first) ? first.url : undefined;
  if (typeof url !== "string") {
    g.issues.push({ path: ["servers", 0, "url"], rule: "required" });
    return undefined;
  }
  if (!/^https?:\/\/[^/]/i.test(url) || !URL.canParse(url)) {
    g.issues.push({ path: ["servers", 0, "url"], rule: "type" });
    return undefined;
  }
  return url;
}
