import { module } from "@keel/compiler";

export default module({
  id: "todos",
  deps: [],
  capabilities: ["net", "storage"],
  public: { exports: ["Suggestion", "Board", "BoardView", "ListDraft", "TodoDraft"], routes: [] },
});
