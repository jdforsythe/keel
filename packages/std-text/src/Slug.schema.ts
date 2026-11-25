import { s } from "@keel/schema";
import { isSlug } from "./isSlug.ts";

const trim = (v: string): string => v.replace(/^-+|-+$/g, "");

/** 1 to 64 characters of `a-z` and `0-9` in hyphen-separated runs (std.text); registered as `text.Slug`. */
export const Slug = s.format("text.Slug", s.string(), {
  check: isSlug,
  gen: { from: s.string(), map: (v) => trim(trim(v.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 64)) || "a" },
});
export type Slug = s.infer<typeof Slug>;

s.register("text.Slug", Slug);
