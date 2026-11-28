import { topology } from "@keel/server";

export default topology({
  web: {
    modules: ["app", "members", "receipts", "sessions", "setup", "shopping"],
    adapter: "node",
    styles: ["@keel/ui/fonts"],
  },
});
