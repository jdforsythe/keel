import { start } from "./server.mjs";
import * as esbuild from "esbuild";
import pw from "playwright";
import fs from "node:fs";
const libs = process.argv[2] ? process.argv[2].split(",") : ["d3", "chartjs", "uplot", "plot", "echarts"];
const engines = (process.argv[3] || "chromium,webkit").split(",");
await esbuild.build({
  entryPoints: libs.map((l) => `src/${l}.js`),
  bundle: true,
  format: "esm",
  outdir: "dist",
  minify: false,
  logLevel: "error",
  loader: { ".css": "empty" },
});
const srv = await start();
const port = srv.address().port;
const out = {};
const kill = setTimeout(() => {
  console.error("global timeout");
  process.exit(2);
}, 540000);
for (const eng of engines) {
  const br = await pw[eng].launch();
  out[eng] = {};
  for (const lib of libs) {
    const src = fs.readFileSync(`src/${lib}.js`, "utf8");
    const names = [...src.matchAll(/^  (?:async )?([a-z_A-Z0-9]+)\(/gm)].map((m) => m[1]);
    out[eng][lib] = {};
    for (const f of names) {
      const ctx = await br.newContext({ viewport: { width: 800, height: 500 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", (e) => errs.push("pageerror: " + String(e.message).slice(0, 200)));
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning")
          errs.push("console." + m.type() + ": " + m.text().slice(0, 250));
      });
      await page.addInitScript(() => {
        window.__viol = [];
        document.addEventListener("securitypolicyviolation", (e) =>
          window.__viol.push({
            dir: e.violatedDirective,
            blocked: e.blockedURI,
            file: (e.sourceFile || "").split("/").pop(),
            line: e.lineNumber,
            sample: (e.sample || "").slice(0, 60),
          }),
        );
      });
      const r = {};
      try {
        await page.goto(`http://127.0.0.1:${port}/p/${lib}${process.env.NOCSP ? "?nocsp=1" : ""}`);
        await page.waitForFunction(() => window.__ready, null, { timeout: 15000 });
        const imp = await page.evaluate(() => window.__res.importError);
        if (imp) r.importError = imp;
        else {
          const o = await page.evaluate(async (f) => {
            try {
              const v = await window.__feats[f]();
              return { v };
            } catch (e) {
              return { thrown: String((e && e.message) || e).slice(0, 250) };
            }
          }, f);
          if (o.thrown) r.thrown = o.thrown;
          else {
            r.checks = o.v;
            const acts = o.v && o.v.actions;
            if (acts) {
              delete r.checks.actions;
              for (const a of acts) {
                if (a[0] === "move") await page.mouse.move(a[1], a[2]);
                else if (a[0] === "wait") await page.waitForTimeout(a[1]);
                else if (a[0] === "drag") {
                  await page.mouse.move(a[1], a[2]);
                  await page.mouse.down();
                  await page.mouse.move((a[1] + a[3]) / 2, (a[2] + a[4]) / 2, { steps: 5 });
                  await page.mouse.move(a[3], a[4], { steps: 5 });
                  await page.mouse.up();
                } else if (a[0] === "wheel") {
                  await page.mouse.move(a[1], a[2]);
                  await page.mouse.wheel(0, a[3]);
                  await page.waitForTimeout(300);
                }
              }
              r.after = await page.evaluate(() => {
                try {
                  return window.__after ? window.__after() : null;
                } catch (e) {
                  return { thrown: String(e) };
                }
              });
            }
          }
        }
      } catch (e) {
        r.harnessError = String(e).slice(0, 200);
      }
      r.violations = await page.evaluate(() => window.__viol).catch(() => null);
      r.errors = errs;
      out[eng][lib][f] = r;
      await ctx.close();
    }
  }
  await br.close();
}
fs.writeFileSync(process.argv[4] || "results.json", JSON.stringify(out, null, 1));
srv.close();
clearTimeout(kill);
console.log("done");
process.exit(0);
