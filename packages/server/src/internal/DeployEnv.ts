import { type ObjectSchema, attempt, s } from "@keel/schema";

/** An absolute `http:` or `https:` URL (a peer's `KEEL_PEER_<NAME>`). */
const PeerUrl = s.format("keel.peerUrl", s.string({ min: 1 }), {
  check: (v) => {
    const u = attempt(() => new URL(v));
    return u.ok && (u.value.protocol === "http:" || u.value.protocol === "https:");
  },
  gen: { from: s.string({ min: 1 }), map: (host) => `http://${host}` },
});

/**
 * The production environment of a `node` deployable (k.topology Build): `PORT` (default 8080), `KEEL_ORIGIN` (the
 * public origin), `KEEL_SECRET` (32+ characters, shared by the app's deployables) and `KEEL_PEER_<NAME>` per peer, an
 * absolute http(s) URL.
 */
export const DeployEnv = (
  peers: readonly string[],
): ObjectSchema<{ PORT?: number; KEEL_ORIGIN?: string; KEEL_SECRET: string; [peer: string]: unknown }> =>
  s.object({
    PORT: s.int({ min: 0, max: 65535 }).optional(),
    KEEL_ORIGIN: s.string({ min: 1 }).optional(),
    KEEL_SECRET: s.string({ min: 32 }),
    ...Object.fromEntries(peers.map((p) => [`KEEL_PEER_${p.toUpperCase()}`, PeerUrl])),
  });
