/** Marks a call into the database held until it answers (k.sim `hold`, labelled for its capability). */
export type Held = <T>(work: Promise<T>) => Promise<T>;
