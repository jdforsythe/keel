import { clip } from "../clip.ts";
import { fail } from "../fail.ts";
import { isSelector } from "../isSelector.ts";
import { nearest } from "../nearest.ts";
import type { ProjectInfo } from "./ProjectInfo.ts";

/**
 * A verb's id, checked before the browser is asked anything (k.e2e-page Verbs): a selector-shaped string is E1701, and
 * an id the project's source cannot render is E1705 naming the three nearest ids of `.keel/ids.json`.
 */
export function knownId(project: ProjectInfo, id: string): string {
  const shown = JSON.stringify(clip(id, 40));
  if (isSelector(id)) throw fail("E1701", `${shown} is a DOM selector; address elements by id`, { id });
  if (project.knows(id)) return id;
  const near = nearest(id, project.ids, 3);
  const hint = near.length === 0 ? ".keel/ids.json holds no ids" : `nearest: ${near.join(", ")}`;
  throw fail("E1705", `no element with id ${shown} in .keel/ids.json; ${hint}`, { id, nearest: near });
}
