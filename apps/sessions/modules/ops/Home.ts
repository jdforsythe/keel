import type { Ctx } from "@keel/ctx";
import { computed, signal } from "@keel/reactive";
import { record } from "@keel/std-sessions";
import { sessions } from "@keel/std-sessions/contract";
import { Box, Button, Heading, Text } from "@keel/ui";

/** The archive bounds `ops.home.limits` shows, in the order the ingest applies them. */
const LIMITS = [
  { label: "Fingerprints", value: "64" },
  { label: "Sessions per fingerprint", value: "5" },
  { label: "Session size", value: "256 KiB" },
  { label: "Archive size", value: "4 MiB" },
] as const;

/** One bound as a line: the label, a dot leader to the widest label's column, and the value. */
function limitLine(limit: (typeof LIMITS)[number], width: number): string {
  return `${limit.label} ${".".repeat(width - limit.label.length + 1)} ${limit.value}`;
}

/**
 * Home of the ingest service (`ops.home`): what it takes and where. `ops.home.endpoint` binds the ingest URL, which
 * only the browser knows in full; that binding makes the page an island, so its resume runs in the browser with the
 * page's ctx. There it records the session and, on the first error, posts it to this service's `sessions.ingest`.
 * Uploads are same-origin, so the upload URL is on the document's origin (`self.origin`). A page whose origin is
 * opaque (a sandboxed frame, `file:`, `about:blank`) has none: it shows the path and records without uploading. The
 * recorder lives until its `stop()`, past this component, and gets the errors the ctx kept since its current route.
 * A server render shows the path and records nothing. A test or replay that started its own recorder keeps that
 * one: `record` returns the ctx's recorder and ignores a second `upload`. `ops.home.limits` shows and hides the
 * archive bounds, one per line, in `ops.home.limits.list`. Plain `.ts` (no JSX).
 */
export default function Home(_props: object, ctx: Ctx): Node {
  const path = sessions.entries["sessions.ingest"].path;
  const own = typeof self !== "undefined" && typeof self.origin === "string" ? self.origin : undefined;
  const origin = typeof location === "undefined" ? null : (own ?? location.origin);
  const upload = origin === null || origin === "null" ? null : URL.parse(path, origin);
  // Created with its value, never set: a render may run inside an effect, where a write is E1201.
  const endpoint = signal<string>(upload?.href ?? path);
  const open = signal(false);
  const width = Math.max(...LIMITS.map((l) => l.label.length));
  if (origin !== null) record(ctx, upload === null ? {} : { upload });
  return Box({
    as: "main",
    id: "ops.home",
    p: "6",
    gap: "4",
    children: () => [
      Heading({ level: 1, fontSize: "2xl", weight: "semibold", m: "0", children: "Keel sessions" }),
      Text({
        as: "p",
        id: "ops.home.intro",
        m: "0",
        children: "This service keeps recorded sessions: 64 fingerprints, the newest 5 of each, 256 KiB per session.",
      }),
      Text({ as: "p", id: "ops.home.endpoint", m: "0", font: "mono", fontSize: "sm", children: endpoint }),
      Button({
        id: "ops.home.limits",
        onClick: () => open.set(!open.get()),
        children: () => computed(() => (open.get() ? "Hide limits" : "Show limits")),
      }),
      Text({
        as: "pre",
        id: "ops.home.limits.list",
        m: "0",
        font: "mono",
        fontSize: "sm",
        children: computed(() => (open.get() ? LIMITS.map((l) => limitLine(l, width)).join("\n") : "")),
      }),
    ],
  });
}
