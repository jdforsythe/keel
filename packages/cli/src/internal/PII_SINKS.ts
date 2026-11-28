/**
 * The sinks of k.privacy and the one conformance clause each that proves its redaction for generated schemas and
 * values (k.evidence `pii.json`), by item (k.ledger-items Clause key): sessions, inputs, the server log and the
 * evidence bundle.
 */
export const PII_SINKS: readonly { readonly sink: string; readonly clause: string }[] = [
  { sink: "sessions", clause: "std.sessions#971e9dd1" },
  { sink: "inputs", clause: "k.privacy#6e6a9059" },
  { sink: "log", clause: "k.privacy#322775dc" },
  { sink: "bundle", clause: "k.evidence#d28b776b" },
];
