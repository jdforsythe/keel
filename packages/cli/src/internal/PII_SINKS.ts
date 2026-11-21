/**
 * The sinks of k.privacy and the one conformance clause each that proves its redaction for generated schemas and
 * values (k.evidence `pii.json`): sessions, inputs, the server log and the evidence bundle.
 */
export const PII_SINKS: readonly { readonly sink: string; readonly clause: string }[] = [
  { sink: "sessions", clause: "std.sessions#2" },
  { sink: "inputs", clause: "k.privacy#7" },
  { sink: "log", clause: "k.privacy#6" },
  { sink: "bundle", clause: "k.evidence#5" },
];
