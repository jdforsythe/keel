import type { Method } from "../contract/types/Method.ts";

/** An API entry's methods, in `allow` order (k.api Paths). */
export const METHODS: readonly Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
