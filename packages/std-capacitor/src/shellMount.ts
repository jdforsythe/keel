import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { Ctx } from "@keel/ctx";
import { mountRequests } from "@keel/router/internal";

/**
 * Lets a Capacitor shell's pages reach the identity mount (k.return), which a shell build's generated entry calls
 * before it starts the router when the project has `identity.ts`. Navigations under `mount` (that file's default
 * export, the only mount read) go through `ctx.net` as mount requests. The external browser is `@capacitor/browser`
 * (Custom Tabs on Android, an in-app Safari view on iOS), opened on `origin`, the build's `KEEL_ORIGIN`, for a root-relative URL. The shell reports its launch to the
 * router once, when `@capacitor/app` `getLaunchUrl` settles (k.links Launch): its URL as the launch link, no URL as no
 * link, a rejection as a failed read. Return links that arrive while running (`appUrlOpen`) are listened for after the
 * report and go to the router's intake, which sorts each by its path (k.links); one that took an opening closes that
 * browser. The launch link is taken once: the first `appUrlOpen` that repeats it is dropped.
 */
export function shellMount(
  ctx: Ctx,
  opts: {
    readonly id: string;
    readonly origin: URL;
    readonly mount: { readonly path: string; readonly links: readonly string[] };
  },
): void {
  const { origin } = opts.origin;
  const { link, launch } = mountRequests(ctx, {
    id: opts.id,
    origin,
    mounts: [opts.mount],
    open: (url) => void Browser.open({ url: new URL(url, origin).href }).catch(() => undefined),
    // Android has no browser to close: the call rejects there.
    close: () => void Browser.close().catch(() => undefined),
  });
  void App.getLaunchUrl()
    .then(
      (at) => at?.url,
      () => null,
    )
    .then((at) => {
      let repeat = at ?? undefined;
      void launch(at === null ? null : at === undefined ? [] : [at]);
      return App.addListener("appUrlOpen", (e) => {
        const again = e.url === repeat;
        repeat = undefined;
        if (!again) void link(e.url);
      });
    })
    .catch(() => undefined);
}
