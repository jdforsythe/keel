import { clipMessage } from "./clipMessage.ts";

/** The shortest a clipped name gets: one unit and `...`. */
const LEAST = 4;

/**
 * The message `build` writes from `names`, fit to `max` units (k.themes Token errors): while it is longer, the longest
 * name keeps its first units and `...` (k.check Diagnostics' clip), as many as bring the message to `max`, then the
 * next longest, so no fixed word is cut. When every name is at its least the message is returned as it is.
 */
export function fitNames(build: (names: readonly string[]) => string, names: readonly string[], max = 89): string {
  const now = [...names];
  for (;;) {
    const message = build(now);
    if (message.length <= max) return message;
    let at = -1;
    for (let i = 0; i < now.length; i++) {
      const len = now[i]?.length ?? 0;
      if (len > LEAST && (at < 0 || len > (now[at]?.length ?? 0))) at = i;
    }
    if (at < 0) return message;
    const len = now[at]?.length ?? 0;
    now[at] = clipMessage(names[at] ?? "", Math.max(LEAST, len - (message.length - max)));
  }
}
