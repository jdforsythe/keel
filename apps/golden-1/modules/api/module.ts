import { module } from "@keel/compiler";

export default module({
  id: "api",
  deps: ["@keel/std-channels", "@keel/std-offline"],
  capabilities: ["clock", "net", "observe", "random", "storage"],
  public: {
    exports: [
      "Board",
      "BoardView",
      "ListDraft",
      "ListParams",
      "Suggestion",
      "Todo",
      "TodoDraft",
      "TodoList",
      "ListWrite",
      "TodoWrite",
      "ToggleWrite",
      "boardChannel",
    ],
    routes: [
      "api.lists",
      "api.listTodos",
      "api.todo",
      "api.todoToggle",
      "api.undo",
      "api.suggestions",
      "api.boardEvents",
    ],
  },
});
