import type { SecretListener } from "./SecretListener.ts";
import { listening } from "./listening.ts";

/**
 * Make `listener` the one function `Secret.of` calls with each new `Secret`, and `reveal` with each `Secret` it opens,
 * replacing any earlier one. The returned function clears the slot if `listener` still holds it. Not app-facing:
 * `@keel/server` reads it to scrub a request's secrets from its log.
 */
export function onSecret(listener: SecretListener): () => void {
  listening.current = listener;
  return () => {
    if (listening.current === listener) listening.current = undefined;
  };
}
