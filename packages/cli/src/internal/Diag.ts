import type { Infer } from "@keel/schema";
import type { DiagSchema } from "./DiagSchema.ts";

/** A diagnostic record (OUTPUT.md). */
export type Diag = Infer<typeof DiagSchema>;
