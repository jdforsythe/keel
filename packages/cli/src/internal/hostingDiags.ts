import type { Topology } from "@keel/compiler";
import { hostLiteralProblems } from "@keel/compiler/hosting/hostLiteralProblems";
import { hostProblems } from "@keel/compiler/hosting/hostProblems";
import { peerOrigins } from "@keel/compiler/hosting/peerOrigins";
import type { OutRecord } from "../types/OutRecord.ts";
import { makeDiag } from "./makeDiag.ts";

/**
 * `keel build`'s k.hosting errors at `topology.ts`: E1566 per bad `host` (`hostProblems`; a non-literal one read from
 * `source`, `hostLiteralProblems`), and, when a `client`
 * deployable is built, E1565 per `KEEL_PEER_<NAME>` in `env` that is not an http(s) origin, naming the key, never the
 * value.
 */
export function hostingDiags(topology: Topology, env: Readonly<Record<string, string>>, source?: string): OutRecord[] {
  const at = { path: "topology.ts", see: "k.hosting" };
  const client = Object.values(topology).some((d) => d.adapter === "client");
  return [
    ...[...(source === undefined ? [] : hostLiteralProblems(source)), ...hostProblems(topology)].map(([, message]) =>
      makeDiag("E1566", message, at),
    ),
    ...(client ? peerOrigins(topology, env).bad : []).map((key) =>
      makeDiag("E1565", `${key} is not an http(s) origin; set it to one, as https://api.example.com`, at),
    ),
  ];
}
