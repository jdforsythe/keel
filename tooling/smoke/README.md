# Browser smoke

`node tooling/smoke/smoke.mjs <png>` loads http://localhost:4173/ (run `pnpm --filter golden-1 build && pnpm --filter golden-1 exec vite preview --port 4173` first) in headless Chromium and prints text, element ids, and console errors. `interact.mjs` adds a list and follows its link. Needs `pnpm exec playwright install chromium` once.
