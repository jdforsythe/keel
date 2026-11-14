import { owner } from "@keel/reactive";

/**
 * Runs `fn` in the calling scope without tracking its reads, so a widget's first read of an app list does not make
 * the enclosing render depend on the app's signals.
 */
export function untracked<T>(fn: () => T): T {
  const sc = owner();
  return sc === undefined ? fn() : sc.run(fn);
}
