import { module } from "@keel/compiler";

export default module({
  id: "digest",
  deps: ["api", "@keel/std-jobs", "@keel/std-schedules"],
  capabilities: ["clock", "random", "storage", "net"],
  public: { exports: [] },
});
