import keel from "@keel/compiler/vite";
import { defineConfig } from "vitest/config";

/** `/api` is the `api` deployable (`pnpm api`, server.ts); dev and preview proxy to it on `KEEL_API_PORT` (4191). */
const proxy = { "/api": `http://localhost:${process.env.KEEL_API_PORT ?? "4191"}` };

export default defineConfig({
  plugins: [keel()],
  server: { proxy },
  preview: { proxy },
  test: { environment: "happy-dom" },
});
