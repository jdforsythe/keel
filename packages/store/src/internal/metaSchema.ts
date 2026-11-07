import { s } from "@keel/schema";

/** Codec for log entry `meta`: a record of JSON values (schema-free beyond JSON). */
export const metaSchema = s.record(s.json());
