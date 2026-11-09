import { pulse } from "@keel/reactive/internal";

/** Fired when a store joins or leaves any registry; `stores()` reads it, so its readers rerun (rfc:0070). */
export const registryPulse: { read(): void; fire(): void } = pulse();
