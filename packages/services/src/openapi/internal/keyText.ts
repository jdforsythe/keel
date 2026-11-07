import { IDENT } from "./IDENT.ts";

/** An object key as source: bare when an identifier, else a JSON string. */
export function keyText(k: string): string {
  return IDENT.test(k) ? k : JSON.stringify(k);
}
