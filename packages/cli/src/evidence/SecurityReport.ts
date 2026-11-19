import { s } from "@keel/schema";

/**
 * `security.json` (k.evidence, k.security): per `node` deployable the response headers and the document policy it
 * sends, the nonce written `<nonce>`; per `client` or `static` one the `csp.txt` policy `keel build` writes.
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
      }),
      s.object({ adapter: s.literal("client"), name: s.string(), csp: s.string() }),
      s.object({ adapter: s.literal("static"), name: s.string(), csp: s.string() }),
    ]),
  ),
});
