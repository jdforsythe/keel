import { firstPaint } from "./firstPaint.ts";

/**
 * Whether a `client` or `static` deployable loads the first-paint scheme script (k.schemes First paint): the app's
 * tokens have both schemes or a `choice` theme (`firstPaint`). No text match decides it, since none sees every
 * `SchemeSelect`.
 */
export async function offersScheme(root: string): Promise<boolean> {
  const p = await firstPaint(root);
  return p.both || p.themes.length > 0;
}
