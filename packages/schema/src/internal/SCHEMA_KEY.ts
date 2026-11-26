/** The own, non-enumerable key that marks a schema `s` built (k.schema Guard); registered, so every copy knows it. */
export const SCHEMA_KEY: unique symbol = Symbol.for("keel.schema");
