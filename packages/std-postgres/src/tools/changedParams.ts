import { type RuleDef, defineRule } from "@keel/check";

/**
 * E2460 (std.postgres-changes, k.check registry): a `changed` whose `params` fail the channel's schema or whose payload
 * exceeds 7,900 bytes. `changed` throws it before any statement runs; the registry holds its explanation.
 */
export const changedParams: RuleDef = defineRule({
  code: "E2460",
  see: "std.postgres-changes",
  message: "changed got params its channel's schema refuses, or a change over 7,900 bytes",
  explain:
    "changed(channel, params) names the channel instance a write changes, so its params are the channel's own: " +
    "parsed by channel.params and sent with pg_notify, whose payload Postgres caps. Fix: " +
    "await t.changed(listChannel, {}) with the params a stream of that channel opens with; keep params to ids, never rows.",
  check: () => [],
});
