import { builtinEnvironments } from "vitest/runtime";

/**
 * Give this worker its own DOM at `url` (std.multi: each user has its own DOM), installed as the harness's DOM is
 * (k.testing renders under Vitest's `happy-dom` environment): the same environment, so the worker's globals are the
 * DOM's where the harness's are (`Event`, `FormData`, `Blob`, `File`, `Headers`, `Request`, `Response`, `URL` and the
 * rest), and `window` and `self` are the global itself.
 */
export async function installDom(url: string): Promise<void> {
  await builtinEnvironments["happy-dom"].setup(globalThis, { happyDOM: { url } });
}
