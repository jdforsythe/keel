/** The notification payload of a change: `{"d":<capability>,"c":<channel name>,"k":<key>}` (std.postgres Wire form). */
export const payloadOf = (capability: string, channel: string, key: string): string =>
  JSON.stringify({ d: capability, c: channel, k: key });
