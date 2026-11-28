import { host } from "@keel/runtime-dom/ops";
import type { HostRun } from "./HostRun.ts";

/**
 * The seam between `Host` and the runtime's host element lifecycle (k.host-element Lifecycle, Parse, Harness and
 * replay), called once per rendered element with its `HostRun`: the runtime's `host` op.
 */
export function runHost<I, E>(el: HTMLElement, run: HostRun<I, E>): void {
  host(el, run);
}
