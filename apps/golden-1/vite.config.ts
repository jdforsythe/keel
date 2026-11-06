import keel from "@keel/compiler/vite";
import { type Plugin, defineConfig } from "vite";

/** Dev-only stub for GET /api/suggestions until the real API lands (backlog 0032). */
const suggestionsStub = (): Plugin => {
  const handler = (
    req: { url?: string },
    res: { setHeader(k: string, v: string): void; end(b: string): void },
    next: () => void,
  ) => {
    if (req.url?.split("?")[0] !== "/api/suggestions") return next();
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify([{ title: "Eggs" }, { title: "Milk" }, { title: "Bread" }]));
  };
  return {
    name: "golden-1-suggestions-stub",
    configureServer: (server) => {
      server.middlewares.use(handler);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(handler);
    },
  };
};

export default defineConfig({ plugins: [keel(), suggestionsStub()] });
