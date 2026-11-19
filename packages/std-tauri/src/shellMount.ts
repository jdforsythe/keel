import type { Ctx } from "@keel/ctx";
import { mountRequests } from "@keel/router/internal";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Lets a Tauri shell's pages reach the identity mount (k.return), which a shell build's generated entry calls before
 * it starts the router when the project has `identity.ts`. Navigations under the mount go through `ctx.net` as mount
 * requests. The external browser is the default browser (`@tauri-apps/plugin-opener`), opened on `origin`, the
 * build's `KEEL_ORIGIN`, for a root-relative URL. The shell reports its launch to the router once, when
 * `@tauri-apps/plugin-deep-link` `getCurrent` settles (k.links Launch): its URLs as the launch links, `null` as no
 * link, a rejection as a failed read. Return links that arrive while running (`onOpenUrl`) are listened for after the
 * report and go to the router's intake, which sorts each by its path (k.links). The launch links are taken once: the
 * first `onOpenUrl` that repeats them is dropped.
 */
export function shellMount(ctx: Ctx, opts: { readonly id: string; readonly origin: URL }): void {
  const { origin } = opts.origin;
  const { link, launch } = mountRequests(ctx, {
    id: opts.id,
    origin,
    open: (url) => void openUrl(new URL(url, origin).href).catch(() => undefined),
  });
  void getCurrent()
    .then(
      (at) => at ?? [],
      () => null,
    )
    .then((at) => {
      let repeat = at?.join("\n");
      void launch(at);
      return onOpenUrl((urls) => {
        const again = urls.join("\n") === repeat;
        repeat = undefined;
        if (!again) for (const url of urls) void link(url);
      });
    })
    .catch(() => undefined);
}
