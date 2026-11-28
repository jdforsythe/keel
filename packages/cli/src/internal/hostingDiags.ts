import type { Topology } from "@keel/compiler";
import { ownFrameProblems } from "@keel/compiler/hosting/ownFrameProblems";
import { peerOrigins } from "@keel/compiler/hosting/peerOrigins";
import { servedByProblems } from "@keel/compiler/hosting/servedByProblems";
import { topologyReadProblems } from "@keel/compiler/hosting/topologyReadProblems";
import type { OutRecord } from "../types/OutRecord.ts";
import { makeDiag } from "./makeDiag.ts";

/**
 * `keel build`'s errors at `topology.ts`: each problem of `source` the static read finds (`topologyReadProblems`: E1552,
 * k.topology, or E1566 for a `servedBy` that is not a string literal), E1566 per bad `servedBy` (`servedByProblems`), and, when a
 * `client` deployable is built, E1565 per `KEEL_PEER_<NAME>` in `env` that is not an http(s) origin, naming the key, never the
 * value; and E1590 (k.origins) per `frame` origin equal to a `KEEL_PEER_<NAME>` or `KEEL_ORIGIN` in `env`, the app's
 * own (`ownFrameProblems`).
 */
export function hostingDiags(topology: Topology, env: Readonly<Record<string, string>>, source?: string): OutRecord[] {
  const at = { path: "topology.ts", see: "k.hosting" };
  const client = Object.values(topology).some((d) => d.adapter === "client");
  return [
    ...[
      ...(source === undefined ? [] : topologyReadProblems(source)),
      ...servedByProblems(topology).map((p) => ["E1566", ...p]),
      ...ownFrameProblems(topology, env).map((p) => ["E1590", ...p]),
    ].map(([code = "", , message = ""]) =>
      makeDiag(code, message, {
        path: at.path,
        see: code === "E1566" ? at.see : code === "E1590" || code === "E1591" ? "k.origins" : "k.topology",
      }),
    ),
    ...(client ? peerOrigins(topology, env).bad : []).map((key) =>
      makeDiag("E1565", `${key} is not an http(s) origin; set it to one, as https://api.example.com`, at),
    ),
  ];
}
