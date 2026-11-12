/** A subscription's state (std.channels Client): `open` once `reset` arrived; `denied` is final. */
export type ChannelStatus = "connecting" | "open" | "offline" | "denied";
