import { module } from "@keel/compiler";

export default module({
  id: "api",
  deps: [],
  capabilities: ["random"],
  public: {
    exports: ["Board", "BoardView", "ListDraft", "ListParams", "Suggestion", "Todo", "TodoDraft", "TodoList"],
    routes: ["api.lists", "api.listTodos", "api.todo", "api.todoToggle", "api.undo", "api.suggestions"],
  },
});
