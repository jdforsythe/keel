import { topology } from "@keel/server";

export default topology({
  web: {
    modules: ["todos"],
    adapter: "client",
    host: "api",
    shells: {
      capacitor: { id: "dev.keel.golden1", name: "Golden 1" },
      tauri: { id: "dev.keel.golden1", name: "Golden 1" },
    },
  },
  api: { modules: ["api", "digest", "sessions"], adapter: "node", storage: "sqlite" },
});
