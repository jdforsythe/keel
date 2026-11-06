/** HTML element names: a bare tag name passed where an id is expected is a selector (E1701). */
export const HTML_TAGS: ReadonlySet<string> = new Set(
  (
    "a abbr address area article aside audio b bdi bdo blockquote body br button canvas caption cite code col " +
    "colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form " +
    "h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark " +
    "menu meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s " +
    "samp script search section select slot small source span strong style sub summary sup svg table tbody td " +
    "template textarea tfoot th thead time title tr track u ul var video wbr"
  ).split(" "),
);
