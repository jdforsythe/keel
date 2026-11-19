import type { Ctx } from "@keel/ctx";
import { mountRequests } from "@keel/router/internal";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Lets a Tauri shell's pages reach the identity mount (k.return), which a shell build's generated entry calls before
 * it starts the router when the project has `identity.ts`. Navigations under the mount go through `ctx.net` as mount
 * requests. The external browser is the default browser (`@tauri-apps/plugin-opener`), opened on `origin`, the
 * build's `KEEL_ORIGIN`, for a root-relative URL. A return link on the scheme `id`, each one the app was launched with
 * (`@tauri-apps/plugin-deep-link` `getCurrent`) and each one it gets while running (`onOpenUrl`), is read as a
 * redirect. The launch links are taken once: the first `onOpenUrl` that repeats them is dropped.
 */
export function shellMount(ctx: Ctx, opts: { readonly id: string; readonly origin: URL }): void {
  const { origin } = opts.origin;
  const take = mountRequests(ctx, {
    id: opts.id,
    origin,
    open: (url) => void openUrl(new URL(url, origin).href).catch(() => undefined),
  });
  const got = (urls: readonly string[]): void => {
    for (const url of urls) void take(url);
  };
  void getCurrent()
    .catch(() => null)
    .then((launch) => {
      let repeat = launch?.join("\n");
      got(launch ?? []);
      return onOpenUrl((urls) => {
        const again = urls.join("\n") === repeat;
        repeat = undefined;
        if (!again) got(urls);
      });
    })
    .catch(() => undefined);
}
