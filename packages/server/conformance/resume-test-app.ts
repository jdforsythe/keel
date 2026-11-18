// The test app of the k.resume suite: one route per case the section names. Not a test file.
import {
  type Level,
  conditionalLayout,
  emptyForPage,
  islandLayout,
  islandPage,
  staticLayout,
  structuralPage,
} from "./resume-app.ts";

/** Island layout around an island page. */
export const TWO: readonly Level[] = [
  { id: "al.layout", source: islandLayout("al"), title: "layout-title" },
  { id: "ap.page", source: islandPage("ap"), path: "/two", layout: "al.layout", title: "page-title" },
];

/** Island layout around a static layout around an island page. */
export const THREE: readonly Level[] = [
  { id: "bl.layout", source: islandLayout("bl"), title: "outer-title" },
  { id: "bm.layout", source: staticLayout("bm"), layout: "bl.layout", title: "middle-title" },
  { id: "bp.page", source: islandPage("bp"), path: "/three", layout: "bm.layout", title: "page-title" },
];

/** Boundary around Match around For around If. */
export const STRUCTURAL: readonly Level[] = [
  { id: "sp.page", source: structuralPage("sp"), path: "/structural", title: "t" },
];

/** A For with no rows and an `empty` branch. */
export const EMPTY: readonly Level[] = [{ id: "ep.page", source: emptyForPage("ep"), path: "/empty", title: "t" }];

/** A layout whose slot is inside an If, served shown. */
export const SHOWN: readonly Level[] = [
  { id: "c1.layout", source: conditionalLayout("c1"), title: "open" },
  { id: "c1p.page", source: islandPage("c1p"), path: "/shown", layout: "c1.layout", title: "page-title" },
];

/** The same layout, served hidden. */
export const HIDDEN: readonly Level[] = [
  { id: "c2.layout", source: conditionalLayout("c2"), title: "closed" },
  { id: "c2p.page", source: islandPage("c2p"), path: "/hidden", layout: "c2.layout", title: "page-title" },
];

/** An island layout that never calls `children`. */
export const ZERO: readonly Level[] = [
  {
    id: "zl.layout",
    source: islandLayout("zl", ""),
    title: "layout-title",
  },
  { id: "zp.page", source: islandPage("zp"), path: "/zero", layout: "zl.layout", title: "page-title" },
];

export type Route = {
  readonly path: string;
  readonly levels: readonly Level[];
  /** A handler on a server element: the button id, the output id and the text the output shows after one click. */
  readonly probes: readonly { readonly click: string; readonly out: string; readonly after: string }[];
};

export const ROUTES: readonly Route[] = [
  {
    path: "/two",
    levels: TWO,
    probes: [
      { click: "al.inc", out: "al.out", after: "1" },
      { click: "ap.inc", out: "ap.out", after: "1" },
    ],
  },
  {
    path: "/three",
    levels: THREE,
    probes: [
      { click: "bl.inc", out: "bl.out", after: "1" },
      { click: "bp.inc", out: "bp.out", after: "1" },
    ],
  },
  { path: "/structural", levels: STRUCTURAL, probes: [{ click: "sp.inc", out: "sp.out", after: "1" }] },
  { path: "/empty", levels: EMPTY, probes: [{ click: "ep.inc", out: "ep.out", after: "1" }] },
  {
    path: "/shown",
    levels: SHOWN,
    probes: [
      { click: "c1.inc", out: "c1.out", after: "1" },
      { click: "c1p.inc", out: "c1p.out", after: "1" },
    ],
  },
  { path: "/hidden", levels: HIDDEN, probes: [{ click: "c2.inc", out: "c2.out", after: "1" }] },
  { path: "/zero", levels: ZERO, probes: [{ click: "zl.inc", out: "zl.out", after: "1" }] },
];

/** Every level of the test app, one app serving every route. */
export const ALL_LEVELS: readonly Level[] = ROUTES.flatMap((r) => r.levels);
