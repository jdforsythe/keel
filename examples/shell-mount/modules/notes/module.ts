import { module } from "@keel/compiler";

export default module({
  id: "notes",
  deps: ["api"],
  capabilities: ["net"],
  public: { exports: ["NoteParams", "SigninSearch"] },
});
