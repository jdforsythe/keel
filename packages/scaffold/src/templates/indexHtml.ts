/** `index.html` of a workspace project: self-hosted brand fonts, a header with the Keel mark, the mount point and the Keel entry. */
export function indexHtml(name: string): string {
  return [
    "<!doctype html>",
    `<html lang="en">`,
    "  <head>",
    `    <meta charset="utf-8" />`,
    `    <title>${name}</title>`,
    `    <link rel="icon" type="image/svg+xml" href="/keel-mark.svg" />`,
    `    <script type="module">import "@keel/ui/fonts";</script>`,
    "  </head>",
    "  <body>",
    "    <header>",
    `      <img src="/keel-mark.svg" alt="Keel" width="32" height="32" />`,
    `      <span>${name}</span>`,
    "    </header>",
    `    <div id="app"></div>`,
    `    <script type="module" src="/@keel/entry.ts"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}
