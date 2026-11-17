import { type SecretListener, onSecret, secretValues } from "@keel/schema/internal";
import { holdSecrets } from "./holdSecrets.ts";
import { requestSecrets } from "./requestSecrets.ts";

/**
 * Adds the revealed strings, numbers and data keys of `made` (`secretValues`) to the set of the request or runner `run`
 * running, if any, and the empty string, which matches nothing: the set then holds a value whenever the scope made a
 * secret, a boolean one too, so past a scrub cap its texts are marked `[secret]` (`scrubbed`). Once the set is past
 * a cap (100,000 values or 2,000,000 characters of forms) it takes no more values (`holdSecrets`).
 */
const note: SecretListener = (made) => {
  const into = requestSecrets.getStore();
  if (into === undefined) return;
  holdSecrets(into, secretValues(made));
};

/**
 * Makes the server's listener the one `onSecret` calls, so each `Secret` made while a request or a runner's `run` runs
 * adds its revealed strings, numbers and data keys to that scope's set (`requestSecrets`) until the set is past a cap; a
 * `Secret` made outside both, at startup, adds nothing. Each `createApp` calls it, so an app created after another listener took the slot, or
 * after the slot was cleared, has the server's listener again.
 */
export function noteRequestSecrets(): void {
  onSecret(note);
}
