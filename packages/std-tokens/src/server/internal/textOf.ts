import { type Secret, reveal } from "@keel/schema";

/** A secret's text: the package's one `reveal`. */
export function textOf(secret: Secret<string>): string {
  return reveal(secret);
}
