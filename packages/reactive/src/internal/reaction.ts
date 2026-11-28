import { rt } from "./rt.ts";

/** The computation whose reads subscribe right now (an identity to compare, never to call), or null. */
export function reaction(): object | null {
  return rt.reaction;
}
