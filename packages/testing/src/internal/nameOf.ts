import { nameAndSource } from "./nameAndSource.ts";

/** Accessible name of `el` with role `role` (see `nameAndSource` for the order of sources). */
export function nameOf(el: Element, role: string): string {
  return nameAndSource(el, role).name;
}
