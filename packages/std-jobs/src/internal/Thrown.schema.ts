import { s } from "@keel/schema";

/** A job's `fn` threw. Nothing is kept of the throw. */
export const Thrown = s.error("jobs.thrown", s.object({}));
