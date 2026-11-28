import { census } from "./census.ts";
import { refusal } from "./refusal.ts";

/**
 * Enter kernel package `name`, evaluated from `url`, in the realm's census (k.realm One copy); a second copy from
 * another file is E1765, a coded refusal naming both URLs, and nothing more of it runs.
 */
export function enrol(name: string, url: string): void {
  const first = census(name, url);
  if (first !== undefined)
    throw refusal("E1765", `two copies of ${name} in one realm: ${first} and ${url.replace(/[?#].*$/, "")}`, "k.realm");
}
