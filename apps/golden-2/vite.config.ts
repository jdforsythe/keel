import keel from "@keel/compiler/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({ plugins: [keel()], test: { environment: "happy-dom" } });
