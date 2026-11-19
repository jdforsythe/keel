import { s } from "@keel/schema";
import { type SecretListener, onSecret, secretWalk } from "@keel/schema/internal";
import { holdSecrets } from "./holdSecrets.ts";
import { notedSecrets } from "./notedSecrets.ts";
import { pastCap } from "./pastCap.ts";
import { requestSecrets } from "./requestSecrets.ts";

/**
 * Adds the revealed strings, numbers and data keys of `made` (`secretWalk`) to the set of the request or runner `run`
 * running, if any, and the empty string, which matches nothing: the set then holds a value whenever the scope made or
 * revealed a secret, a boolean one too, so past a scrub cap its texts are marked `[secret]` (`scrubbed`). Each `Secret`
 * is walked once per set (`notedSecrets`); outside every scope nothing is read or kept. Once the set is past a cap
 * (100,000 values or 2,000,000 characters of forms) it takes no more values (`holdSecrets`). A read of `made` cut at
 * its 1,000,000 values left values unread, so the set is past its cap (`pastCap`) and every text of the scope is one
 * mark.
 */
let probing = false;
let losses = 0;
const PROBE = s.secret(s.boolean());

const note: SecretListener = (made) => {
  if (probing) {
    probing = false;
    return;
  }
  const into = requestSecrets.getStore();
  if (into === undefined) return;
  let noted = notedSecrets.get(into);
  if (noted === undefined) {
    noted = new WeakSet();
    notedSecrets.set(into, noted);
  } else if (noted.has(made)) return;
  noted.add(made);
  const read = secretWalk(made);
  holdSecrets(into, read.values);
  if (read.cut) pastCap.add(into);
};

/**
 * Makes the server's listener the one `onSecret` calls, so each `Secret` made or revealed while a request or a runner's
 * `run` runs adds its revealed strings, numbers and data keys to that scope's set (`requestSecrets`) until the set is
 * past a cap. A `Secret` made at startup adds nothing until a scope reveals it; a value revealed outside every scope
 * and kept as plain text is in no set. Before it takes the slot it makes a probe `Secret` to learn whether the slot
 * still held the listener; each time it did not (another package cleared or replaced it), the count it returns grows.
 * Each `createApp`, each request and each runner's `run` calls it, and each scope's texts are scrubbed only while the
 * count is the one its scope began with (`slotSince`, `scrubbed`).
 */
export function noteRequestSecrets(): number {
  probing = true;
  PROBE.parse(true);
  if (probing) losses++;
  probing = false;
  onSecret(note);
  return losses;
}
