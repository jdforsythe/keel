import type { Mismatch } from "./Mismatch.ts";

/** One island's resume attempt; `failed` holds the first structural mismatch (E1253). */
export interface Hydration {
  failed: Mismatch | null;
}
