import { module } from "@keel/compiler";

export default module({
  id: "api",
  deps: [
    "@keel/std-channels",
    "@keel/std-jobs",
    "@keel/std-offline",
    "@keel/std-sessions",
    "@keel/std-statecharts",
    "@keel/std-workflows",
  ],
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
      "Removal",
      "Nothing",
    ],
    routes: [
      "api.lists",
      "api.listTodos",
      "api.todo",
      "api.todoToggle",
      "api.undo",
      "api.suggestions",
      "api.boardEvents",
      "api.removeList",
      "api.undoRemoval",
    ],
  },
  std: { "@keel/std-sessions": { readers: [] } },
});
