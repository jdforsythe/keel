import type { KeelError } from "@keel/schema";

/** A save refused because a store the request read was saved by another request since (`saveStores`). */
export type SaveConflict = KeelError<"keel.conflict", { store: string }>;
