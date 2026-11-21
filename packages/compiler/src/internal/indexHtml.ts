/**
 * The `index.html` a `client` deployable `name` builds from when the project has none (k.hosting Artifact): the
 * deployable's name as its title, the Keel mark as its icon, an `#app` element and the generated entry, every URL
 * root-absolute.
 */
export function indexHtml(name: string, entry: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${name.replace(/[<&]/g, "")}</title>`,
    '    <link rel="icon" href="/keel-mark.svg" type="image/svg+xml" />',
    "  </head>",
    "  <body>",
    '    <div id="app"></div>',
    `    <script type="module" src="${entry}"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}
