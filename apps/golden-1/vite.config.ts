import keel from "@keel/compiler/vite";
import { defineConfig } from "vite";

/** `/api` is the `api` deployable (`pnpm api`, server.ts); dev and preview proxy to it on `KEEL_API_PORT` (4181). */
const proxy = { "/api": `http://localhost:${process.env.KEEL_API_PORT ?? "4181"}` };

export default defineConfig({ plugins: [keel()], server: { proxy }, preview: { proxy } });
