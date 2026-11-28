/** A log entry named in a race (std.conflicts): its `id` (the head its commit produced), transaction `name` and write `key`. */
export interface Ref {
  readonly id: number;
  readonly name: string;
  readonly key?: string;
}
