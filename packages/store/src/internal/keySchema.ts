import { s } from "@keel/schema";

/** Codec for a write's `key`: names one write across retries. */
export const keySchema = s.string({ min: 1, max: 64 });
