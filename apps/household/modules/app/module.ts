import { module } from "@keel/compiler";

export default module({
  id: "app",
  deps: ["members", "receipts", "setup", "shopping", "@keel/std-headless", "@keel/std-sessions"],
  capabilities: ["clock", "observe", "session", "storage"],
  public: { exports: [] },
  // The caller hashes `sessions.list` and `sessions.tally` admit: none until an operator adds theirs (README, Layer 10).
  std: { "@keel/std-sessions": { readers: [] } },
});
