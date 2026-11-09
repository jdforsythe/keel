import { Box, Heading, Text } from "@keel/ui";
import type { Listing } from "./Listing.schema.ts";

/** One archive row: fingerprint, count and the code of its newest session's error (`ok` for none). */
function row(fp: string, e: Listing[string]): Node {
  const code = e.sessions.at(-1)?.error?.code ?? "ok";
  return Box({
    as: "li",
    id: `sessions.row.${fp}`,
    children: Text({ font: "mono", fontSize: "sm", children: `${fp} ${e.count} ${code}` }),
  });
}

/**
 * Document view of `sessions.ingest` and `sessions.list` (std.sessions Ingest). Plain `.ts` so a node deployable
 * loads it with type stripping. The ingest page says what it takes; the list page lists each fingerprint.
 */
export default function SessionsView(props: { readonly data?: Listing }): Node {
  const archive = props.data;
  return Box({
    as: "main",
    id: "sessions.page",
    p: "6",
    gap: "4",
    children: [
      Heading({ level: 1, fontSize: "2xl", weight: "semibold", m: "0", children: "Sessions" }),
      archive === undefined
        ? Text({ as: "p", id: "sessions.intro", children: "POST a recorded session here as JSON, up to 256 KiB." })
        : Box({
            as: "ul",
            id: "sessions.list",
            children: Object.keys(archive)
              .sort()
              .flatMap((fp) => {
                const e = archive[fp];
                return e === undefined ? [] : [row(fp, e)];
              }),
          }),
    ],
  });
}
