import { topology } from "@keel/server";

export default topology({
  web: {
    modules: ["todos"],
    adapter: "client",
    servedBy: "api",
    styles: ["@keel/ui/fonts"],
    shells: {
      capacitor: { id: "dev.keel.golden1", name: "Golden 1" },
      tauri: { id: "dev.keel.golden1", name: "Golden 1" },
    },
  },
  api: { modules: ["api", "digest", "sessions"], adapter: "node", storage: "sqlite", styles: ["@keel/ui/fonts"] },
});
