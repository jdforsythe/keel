import keel from "@keel/compiler/vite";
import { defineConfig } from "vite";

/** `/api` is the `api` deployable (`pnpm api`, server.ts on port 4181); dev and preview proxy to it. */
const proxy = { "/api": "http://localhost:4181" };

export default defineConfig({ plugins: [keel()], server: { proxy }, preview: { proxy } });
