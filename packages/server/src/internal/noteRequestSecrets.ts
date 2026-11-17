import { type SecretListener, onSecret, secretValues } from "@keel/schema/internal";
import { requestSecrets } from "./requestSecrets.ts";

/** Adds the revealed strings and numbers of `made` (`secretValues`) to the set of the request running, if any. */
const note: SecretListener = (made) => {
  const into = requestSecrets.getStore();
  if (into !== undefined) for (const v of secretValues(made)) into.add(v);
};

/**
 * Makes the server's listener the one `onSecret` calls, so each `Secret` made while a request runs adds its revealed
 * strings and numbers to that request's set (`requestSecrets`); a `Secret` made outside a request adds nothing. Each
 * `createApp` calls it, so an app created after another listener took the slot, or after the slot was cleared, has
 * the server's listener again.
 */
export function noteRequestSecrets(): void {
  onSecret(note);
}
