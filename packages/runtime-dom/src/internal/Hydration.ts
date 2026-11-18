import type { Mismatch } from "./Mismatch.ts";

/**
 * One island's resume attempt; `failed` holds the first structural mismatch (E1253). `shadowed` lists the claimed
 * server elements whose `childNodes` hide their server regions until the claim ends (`alignTexts`).
 */
export interface Hydration {
  failed: Mismatch | null;
  readonly shadowed: Element[];
}
