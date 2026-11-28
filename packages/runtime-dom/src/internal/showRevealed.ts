import { revealed } from "./revealed.ts";

/** Remove `hidden` from every element `reveal` built since the last call: the end of a `mount` or a `resume`. */
export function showRevealed(): void {
  for (const el of revealed.splice(0)) el.removeAttribute("hidden");
}
