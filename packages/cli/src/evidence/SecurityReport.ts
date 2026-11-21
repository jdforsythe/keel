import { s } from "@keel/schema";

/** One declared origin (k.evidence, k.origins): its directive, the exact origin and the author's reason. */
const Declared = s.object({
  directive: s.enum(["img", "media", "font", "connect", "frame"]),
  origin: s.string(),
  reason: s.string(),
});

/**
 * `security.json` (k.evidence, k.security): per `node` deployable the response headers and the document policy it
 * sends, the nonce written `<nonce>`; per `client` or `static` one the `csp.txt` policy `keel build` writes. Each
 * entry lists its declared `origins` (k.origins), directives in the order `img`, `media`, `font`, `connect`, `frame`
 * and origins in declaration order, `[]` with none.
 */
export const SecurityReport = s.object({
  v: s.literal(1),
  deployables: s.array(
    s.union("adapter", [
      s.object({
        adapter: s.literal("node"),
        name: s.string(),
        headers: s.record(s.string()),
        policy: s.string(),
        origins: s.array(Declared),
      }),
      s.object({ adapter: s.literal("client"), name: s.string(), csp: s.string(), origins: s.array(Declared) }),
      s.object({ adapter: s.literal("static"), name: s.string(), csp: s.string(), origins: s.array(Declared) }),
    ]),
  ),
});
