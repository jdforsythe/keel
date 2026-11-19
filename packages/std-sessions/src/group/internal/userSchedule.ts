import type { Schedule } from "@keel/ctx";

/**
 * User `index`'s schedule of a group of `count` users (std.multi Schedules): every `count`-th step of `schedule.net`
 * from `index`, the group's `offline` windows, and no `storage` or `plans` steps.
 */
export function userSchedule(schedule: Schedule, index: number, count: number): Schedule {
  return {
    net: schedule.net.filter((_, n) => n % count === index),
    storage: [],
    offline: schedule.offline,
    plans: {},
  };
}
