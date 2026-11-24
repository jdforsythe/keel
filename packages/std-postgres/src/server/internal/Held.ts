/** Marks a call into the database held until it answers (k.drive: `hold` under the label `<capability> query`). */
export type Held = <T>(start: () => Promise<T>) => Promise<T>;
