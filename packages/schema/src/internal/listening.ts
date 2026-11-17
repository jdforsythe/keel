import type { SecretListener } from "./SecretListener.ts";

/** The one listener slot `Secret.of` and `reveal` read; `undefined` when nothing listens. Written only by `onSecret`. */
export const listening: { current: SecretListener | undefined } = { current: undefined };
