/** `index.html` of a workspace project: the mount point and the Keel entry. */
export function indexHtml(name: string): string {
  return [
    "<!doctype html>",
    `<html lang="en">`,
    "  <head>",
    `    <meta charset="utf-8" />`,
    `    <title>${name}</title>`,
    "  </head>",
    "  <body>",
    `    <div id="app"></div>`,
    `    <script type="module" src="/@keel/entry.ts"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}
