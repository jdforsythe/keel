import type { Guard } from "../types/Guard.ts";

/** Guards by name, registered by `guard()`; routes reference them by name and resolve at navigation. */
export const guardTable = new Map<string, Guard>();
