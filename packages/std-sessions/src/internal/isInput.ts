import type { SessionEvent } from "../SessionEvent.ts";

/** Whether `e` is an input (`fire`, `nav` or `net`, which `replay` applies) rather than an observation. */
export const isInput = (e: SessionEvent): boolean => e.kind === "fire" || e.kind === "nav" || e.kind === "net";
