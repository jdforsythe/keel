import { module } from "@keel/compiler";

export default module({
  id: "members",
  deps: ["@keel/std-postgres", "@keel/std-temporal", "@keel/std-text", "@keel/std-tokens"],
  capabilities: ["clock", "random", "storage", "members.db"],
  public: { exports: ["signedIn", "member", "Masthead", "ShellData", "shellText", "ShellText"] },
});
