import type { HostEntry } from "./HostEntry.ts";

/** The host elements rendered in a harness, by element (k.host-element Harness and replay). */
export const hosts = new WeakMap<Element, HostEntry>();
