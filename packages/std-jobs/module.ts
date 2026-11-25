import { module } from "@keel/compiler";

/** The `@keel/std-jobs` library manifest (std.jobs, k.library): a module that defines jobs lists the package in `deps`. */
export default module({
  id: "jobs",
  deps: [],
  capabilities: ["clock", "random", "storage"],
  public: {
    exports: ["EnqueueOptions", "InputOf", "Job", "job", "JobsConfig", "JobsQueue", "JobTable", "Queue", "queue"],
  },
});
