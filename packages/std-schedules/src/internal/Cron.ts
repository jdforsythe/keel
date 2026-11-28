/** A parsed five-field cron (std.schedules): each field's values ascending, and whether each day field is restricted. */
export type Cron = {
  readonly mi: readonly number[];
  readonly h: readonly number[];
  readonly dom: readonly number[];
  readonly mon: readonly number[];
  readonly dow: readonly number[];
  readonly domR: boolean;
  readonly dowR: boolean;
};
