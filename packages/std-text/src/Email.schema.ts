import { s } from "@keel/schema";
import { isEmail } from "./isEmail.ts";

const host = (v: string): string => v.replace(/[^A-Za-z0-9]/g, "").slice(0, 63) || "example";

/** An ASCII email address, kept as written (std.text); registered as `text.Email`. */
export const Email = s.format("text.Email", s.string(), {
  check: isEmail,
  gen: { from: s.string(), map: (v) => `${v.replace(/[^\w+-]/g, "").slice(0, 64) || "a"}@${host(v)}.com` },
});
export type Email = s.infer<typeof Email>;

s.register("text.Email", Email);
