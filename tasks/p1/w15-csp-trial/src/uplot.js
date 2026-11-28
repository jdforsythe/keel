import uPlot from "uplot";
import { root, pixels, styleInfo, nodes } from "./common.js";
const mk = (o = {}) => {
  const xs = [...Array(20).keys()];
  const u = new uPlot(
    {
      width: 500,
      height: 250,
      title: "t",
      series: [{}, { label: "A", stroke: "red" }, { label: "B", stroke: "blue" }],
      ...o,
    },
    [xs, xs.map((x) => Math.sin(x / 3)), xs.map((x) => Math.cos(x / 3))],
    root(),
  );
  window.__u = u;
  return u;
};
export const features = {
  async basic() {
    const u = mk();
    await new Promise((r) => setTimeout(r, 500));
    const c = root().querySelector("canvas");
    return {
      pixels: pixels(c),
      canvasSize: c.width + "x" + c.height,
      ...styleInfo(),
      nodes: nodes(root()),
      uplotWrapStyleAttr: root().querySelector(".uplot").getAttribute("style"),
      canvasStyleAttr: c.getAttribute("style"),
    };
  },
  legend() {
    mk();
    const l = root().querySelector(".u-legend");
    return {
      legendRows: root().querySelectorAll(".u-series").length,
      legendText: l?.textContent,
      legendDisplay: l && getComputedStyle(l).display,
    };
  },
  cursor() {
    const u = mk();
    window.__after = () => ({
      idx: u.cursor.idx,
      legendValue: root().querySelector(".u-value")?.textContent,
      cursorLineDisplay: getComputedStyle(root().querySelector(".u-cursor-x")).display,
    });
    const r = root().querySelector(".u-over").getBoundingClientRect();
    return {
      actions: [
        ["move", r.left + 100, r.top + 50],
        ["move", r.left + 200, r.top + 60],
        ["wait", 200],
      ],
    };
  },
  select_zoom() {
    const u = mk();
    window.__after = () => ({
      xmin: u.scales.x.min,
      xmax: u.scales.x.max,
      selectDisplay: getComputedStyle(root().querySelector(".u-select")).display,
    });
    const r = root().querySelector(".u-over").getBoundingClientRect();
    return { actions: [["drag", r.left + 50, r.top + 50, r.left + 200, r.top + 60]] };
  },
};
