import { scope } from "@keel/reactive";
import { live } from "@keel/std-live";
import { fixedTime } from "@keel/tooling/test-time";
import { simulate } from "@keel/testing";
import { expect, it } from "vitest";
import { copy } from "../modules/shopping/copy.store.ts";
import { hydrate } from "../modules/shopping/hydrate.transaction.ts";
import { listChannel } from "../modules/shopping/listChannel.schema.ts";
import { shoppingApi } from "../modules/shopping/shoppingApi.ts";
import { household } from "./household.ts";
import { asJson } from "./serve.ts";

/**
 * Grace follows the list from a browser whose network drops, delays, loses and 503s requests and goes offline in
 * windows, as each generated schedule says; Ada writes to the server meanwhile. Whatever the schedule, once the
 * network is back Grace's copy is the server's list and her status is live. The run budget is this timeout (k.drive
 * Stalls). 25 runs take 2.7 s here, about 110 ms each, in the machine's own work (the server's round trips); the bound is
 * 120 s, 44 times that for the CI runner (8.5 times) and the other workers on its cores, and the machine's work does not
 * shrink with the time scale.
 */
it(
  "catches up with the server's list after every schedule of drops and offline windows",
  async () => {
    const h = await household(21);
    let n = 0;
    await simulate(
      async ({ ctx, run }) => {
        // The browser's requests reach the one server with Grace's session cookie: the stream at the origin `live` is
        // given, the list at the test document's origin, where a service call in a browser goes (k.services).
        const toServer = (req: Request) => {
          const url = new URL(req.url);
          const headers = new Headers(req.headers);
          headers.set("cookie", h.graceCookie);
          return h.raw(
            new Request(`http://localhost${url.pathname}${url.search}`, {
              method: req.method,
              headers,
              signal: req.signal,
            }),
          );
        };
        ctx.net.route("http://localhost/*", toServer);
        ctx.net.route(`${location.origin}/*`, toServer);
        const page = scope(() => undefined);
        const status = page.run(() =>
          live(
            ctx,
            "http://localhost",
            listChannel,
            {},
            { read: (c, signal) => shoppingApi.items({ signal }, c), hydrate },
          ),
        );
        n += 1;
        await h.raw(asJson("POST", "/api/items", { name: `Item ${n}` }, { cookie: h.adaCookie }));
        await run();
        ctx.net.setOnline(true);
        // The server is a household of its own, on a ctx the run does not drive. Each turn waits for one round trip to
        // it and moves the page's clock 5 s, so a reconnect that waits up to 30 s gets there.
        for (let turn = 0; turn < 60 && status() !== "live"; turn++) {
          await h.raw(asJson("GET", "/api/items", undefined, { cookie: h.adaCookie }));
          ctx.clock.advance(5_000);
          await run();
        }
        const server = await (await h.raw(asJson("GET", "/api/items", undefined, { cookie: h.adaCookie }))).json();
        expect(copy.get("items")).toEqual(server.results["shopping.items"].value.items);
        expect(status()).toBe("live");
        page.dispose();
      },
      // The scenario counts its calls (`n`) and the server outlives the runs, so a replay is a different run: no law check.
      { runs: 25, seed: 7, horizon: 120_000, law: false },
    );
  },
  fixedTime(120_000),
);
