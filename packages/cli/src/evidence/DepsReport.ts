import { s } from "@keel/schema";

/**
 * `deps.json` (k.evidence): each production dependency as a CycloneDX 1.5 component, and the advisories of a
 * `pnpm audit --json` file passed with `--audit` (else `null`).
 */
export const DepsReport = s.object({
  bomFormat: s.literal("CycloneDX"),
  specVersion: s.literal("1.5"),
  components: s.array(
    s.object({
      type: s.literal("library"),
      name: s.string(),
      version: s.string(),
      purl: s.string(),
      hashes: s.array(s.object({ alg: s.string(), content: s.string() })),
      licenses: s.array(s.object({ license: s.object({ name: s.string() }) })),
    }),
  ),
  advisories: s
    .array(
      s.object({
        id: s.int(),
        module: s.string(),
        severity: s.string(),
        title: s.string(),
        url: s.string(),
        vulnerable: s.string(),
        patched: s.string(),
      }),
    )
    .nullable(),
});
