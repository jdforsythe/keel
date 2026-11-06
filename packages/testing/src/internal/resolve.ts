import { clip } from "./clip.ts";
import { elementsWithId } from "./elementsWithId.ts";
import { fail } from "./fail.ts";
import { isSelector } from "./isSelector.ts";
import { nearest } from "./nearest.ts";

/**
 * The element with id `id` under `root`. A selector-shaped string is E1701 (tests address elements by id only);
 * an absent id is E1705 listing the three nearest ids.
 */
export function resolve(root: Element, id: string): Element {
  const all = elementsWithId(root);
  const hit = all.find((el) => el.id === id);
  if (hit !== undefined) return hit;
  const shown = JSON.stringify(clip(id, 40));
  if (isSelector(id)) throw fail("E1701", `${shown} is a DOM selector; address elements by id`, { id });
  const near = nearest(id, [...new Set(all.map((el) => el.id))], 3);
  const hint = near.length === 0 ? "the render has no ids" : `nearest: ${near.join(", ")}`;
  throw fail("E1705", `no element with id ${shown}; ${hint}`, { id, nearest: near });
}
