import { s } from "@keel/schema";
import { heldSet } from "@keel/schema/internal";
import { type SecretListener, onSecret, secretWalk } from "@keel/schema/internal";
import { holdSecrets } from "./holdSecrets.ts";
import { notedSecrets } from "./notedSecrets.ts";
import { pastCap } from "./pastCap.ts";
import { requestSecrets } from "./requestSecrets.ts";
import { tallyOf } from "./tallyOf.ts";

/**
 * Adds the revealed strings, numbers and data keys of `made` (`secretWalk`) to the set of the request or runner `run`
 * running, if any, and the empty string, which matches nothing: the set then holds a value whenever the scope made or
 * revealed a secret, a boolean one too, so past the scrub's cap its texts are marked `[secret]` (`scrubbed`). Each
 * `Secret` is walked once per set (`notedSecrets`); outside every scope nothing is read or kept. Once the scope is past
 * 65,536 bytes of distinct values it takes no more (`holdSecrets`). A read of `made` cut at its 1,000,000 values left
 * values unread, so every set of the scope is past the cap (`pastCap`) and every text of the scope is one mark.
 */
// 1 while a probe `Secret` is made; the listener sets it back to 0.
let probing = 0;
let losses = 0;
const PROBE = s.secret(s.boolean());

const note: SecretListener = (made) => {
  if (probing) {
    probing = 0;
    return;
  }
  const into = requestSecrets.getStore();
  if (into === undefined) return;
  let noted = notedSecrets.get(into);
  if (noted === undefined) {
    noted = heldSet();
    notedSecrets.set(into, noted);
  } else if (noted.has(made)) return;
  noted.add(made);
  const read = secretWalk(made);
  holdSecrets(into, read.values);
  if (read.cut) for (const set of tallyOf(into).sets) pastCap.add(set);
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
  probing = 1;
  PROBE.parse(true);
  losses += probing;
  probing = 0;
  onSecret(note);
  return losses;
}
