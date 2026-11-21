import { loader } from "@keel/router";
import { attempt, ok } from "@keel/schema";
import { digest } from "./digest.contract.ts";
import { readLatest } from "./readLatest.ts";

/** How often the feed reads the stored digest, in `ctx.clock` ms. */
const POLL_MS = 1000;

/**
 * `GET /digest/feed`, a live loader: the newest digest, then each different digest a later count stores, read every
 * second until the request ends or the deployable closes.
 */
export const feedDigest = loader(digest, "digest.feed", {}, async function* ({ signal }, ctx) {
  let last = await readLatest(ctx);
  yield ok(last);
  while (!signal.aborted) {
    const waited = await attempt(() => ctx.clock.after(POLL_MS, signal));
    if (!waited.ok) return;
    const now = await readLatest(ctx);
    if (now.at !== last.at || now.open !== last.open || now.done !== last.done) {
      last = now;
      yield ok(now);
    }
  }
});
