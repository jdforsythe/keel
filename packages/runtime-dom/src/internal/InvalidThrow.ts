import type { InvalidValueError } from "../types/InvalidValueError.ts";

/** The throw that carries a host element's `schema.invalid` to the nearest Boundary unchanged (`toCaught`). */
export class InvalidThrow extends Error {
  readonly error: InvalidValueError;
  constructor(error: InvalidValueError) {
    super(error.message);
    this.error = error;
  }
}
