import type { Found } from "./Found.ts";
import type { Novelty } from "./Novelty.ts";

/** A finding at `<head>` with its novelty, and the `<base>` finding it was matched to (standing or changed). */
export type Judged = { readonly found: Found; readonly novelty: Novelty; readonly base?: Found };
