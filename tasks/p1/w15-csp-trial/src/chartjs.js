import { Chart, registerables } from "chart.js";
import { root, pixels, styleInfo } from "./common.js";
Chart.register(...registerables);
const mk = (type, opts = {}) => {
  const c = document.createElement("canvas");
  root().append(c);
  const labels = ["a", "b", "c", "d", "e", "f"];
  const ch = new Chart(c, {
    type,
    data: {
      labels,
      datasets: [
        {
          label: "Series A",
          data: [5, 9, 3, 8, 6, 10],
          backgroundColor: "rgba(200,0,0,.6)",
          borderColor: "rgb(200,0,0)",
        },
        {
          label: "Series B",
          data: [2, 4, 7, 3, 9, 5],
          backgroundColor: "rgba(0,0,200,.6)",
          borderColor: "rgb(0,0,200)",
        },
      ],
    },
    options: opts,
  });
  window.__chart = ch;
  return { c, ch };
};
const res = (c) => ({
  pixels: pixels(c),
  ...styleInfo(),
  canvasStyle: c.getAttribute("style"),
  parentStyle: c.parentElement.getAttribute("style"),
});
export const features = {
  async line() {
    const { c } = mk("line");
    await new Promise((r) => setTimeout(r, 900));
    return res(c);
  },
  async bar() {
    const { c } = mk("bar");
    await new Promise((r) => setTimeout(r, 900));
    return res(c);
  },
  async animation() {
    const { c, ch } = mk("bar", { animation: { duration: 300 } });
    await new Promise((r) => setTimeout(r, 700));
    return { ...res(c), animating: ch.animating };
  },
  tooltip_legend() {
    const { c, ch } = mk("line", { plugins: { tooltip: { enabled: true } } });
    const before = pixels(c);
    window.__after = () => {
      const a = ch.tooltip;
      return {
        tooltipOpacity: a.opacity,
        tooltipTitle: a.title,
        activeEls: ch.getActiveElements().length,
        legendItems: ch.legend.legendItems.length,
        pixelsBefore: before,
        pixelsAfter: pixels(c),
        ...styleInfo(),
      };
    };
    const pt = ch.getDatasetMeta(0).data[2];
    const r = c.getBoundingClientRect();
    return {
      actions: [
        ["move", r.left + pt.x - 5, r.top + pt.y],
        ["move", r.left + pt.x, r.top + pt.y],
        ["wait", 500],
      ],
    };
  },
  responsive_resize() {
    const { c, ch } = mk("line", { responsive: true });
    root().style.width = "300px";
    return new Promise((r) => setTimeout(() => r({ ...res(c), cssWidth: c.style.width, w: ch.width }), 500));
  },
};
