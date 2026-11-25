import { raise } from "../../../unsafe/raise.ts";
import { codeError } from "../../internal/codeError.ts";
import type { ChangedChannel } from "../ChangedChannel.ts";
import { canonicalJson } from "./canonicalJson.server.ts";
import { payloadOf } from "./payloadOf.server.ts";

/** The most bytes a change's payload holds; Postgres refuses a notification payload of 8,000 bytes. */
const MAX_BYTES = 7_900;

/**
 * The payload of `changed(channel, params)` on `capability`: `params` parsed by the channel's schema and keyed as the
 * canonical JSON of its encoded value. A failed parse or a payload over 7,900 bytes throws E2460, naming no param.
 */
export function changeText<P>(capability: string, channel: ChangedChannel<P>, params: P): string {
  const parsed = channel.params.parse(params);
  if (!parsed.ok)
    return raise(codeError("E2460", `changed: params do not fit channel ${channel.name}'s params schema`));
  const text = payloadOf(capability, channel.name, canonicalJson(channel.params.encode(parsed.value)));
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES)
    return raise(codeError("E2460", `changed: a change of channel ${channel.name} is over 7,900 bytes`));
  return text;
}
