import type { Secret } from "../Secret.ts";

/** Called with each `Secret` as it is made (`Secret.of`); never with a raw value. */
export type SecretListener = (made: Secret<unknown>) => void;
