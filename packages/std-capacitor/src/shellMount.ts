import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { Ctx } from "@keel/ctx";
import { mountRequests } from "@keel/router/internal";

/**
 * Lets a Capacitor shell's pages reach the identity mount (k.return), which a shell build's generated entry calls
 * before it starts the router when the project has `identity.ts`. Navigations under the mount go through `ctx.net`
 * as mount requests. The external browser is `@capacitor/browser` (Custom Tabs on Android, an in-app Safari view on
 * iOS), opened on `origin`, the build's `KEEL_ORIGIN`, for a root-relative URL. A return link on the scheme `id`, the
 * one the app was launched with (`@capacitor/app` `getLaunchUrl`) and each one it gets while running (`appUrlOpen`),
 * goes to the router's intake, which admits it only while a mount request's opening is pending (one link per
 * opening); one admitted closes that browser and is read as a redirect. The launch link is taken once: the first `appUrlOpen` that repeats
 * it is dropped.
 */
export function shellMount(ctx: Ctx, opts: { readonly id: string; readonly origin: URL }): void {
  const { origin } = opts.origin;
  const take = mountRequests(ctx, {
    id: opts.id,
    origin,
    open: (url) => void Browser.open({ url: new URL(url, origin).href }).catch(() => undefined),
    // Android has no browser to close: the call rejects there.
    close: () => void Browser.close().catch(() => undefined),
  });
  const got = (url: string): void => void take(url);
  void App.getLaunchUrl()
    .catch(() => undefined)
    .then((launch) => {
      let repeat = launch?.url;
      if (repeat !== undefined) got(repeat);
      return App.addListener("appUrlOpen", (e) => {
        const again = e.url === repeat;
        repeat = undefined;
        if (!again) got(e.url);
      });
    })
    .catch(() => undefined);
}
