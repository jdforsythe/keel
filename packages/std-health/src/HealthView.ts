import { Box } from "@keel/ui";
import type { Health } from "./Health.ts";

/** Document view of `health.status` (std.health): a `main` with id `health.status` and the status text. */
export default function HealthView(props: { readonly data: Health }): Node {
  return Box({ as: "main", id: "health.status", children: props.data.status });
}
