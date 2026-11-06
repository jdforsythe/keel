import type { Entry } from "./Entry.ts";
import { kernelFormatters } from "./kernelFormatters.ts";

/** The formatter registry: one entry per record kind. Seeded with the kernel kinds at module load. */
export const registry: Map<string, Entry> = new Map(kernelFormatters);
