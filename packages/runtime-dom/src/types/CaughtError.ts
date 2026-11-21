import type { InvalidValueError } from "./InvalidValueError.ts";
import type { UnexpectedError } from "./UnexpectedError.ts";

/**
 * What a Boundary's fallback receives (k.errors): `keel.unexpected` for any throw, or a host element's
 * `schema.invalid` (k.host-element Parse); both carry `data.at`, the element id where it surfaced.
 */
export type CaughtError = UnexpectedError | InvalidValueError;
