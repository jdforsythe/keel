import * as echarts from "echarts";
import { root, pixels, nodes, styleInfo } from "./common.js";
const opt = (extra = {}) => ({
  xAxis: { type: "category", data: ["a", "b", "c", "d", "e"] },
  yAxis: { type: "value" },
  legend: { data: ["A", "B"] },
  tooltip: { trigger: "axis" },
  series: [
    { name: "A", type: "line", data: [5, 9, 3, 8, 6] },
    { name: "B", type: "line", data: [2, 4, 7, 3, 9] },
  ],
  animation: false,
  ...extra,
});
const mk = (renderer, o) => {
  const d = document.createElement("div");
  d.style.width = "500px";
  d.style.height = "300px";
  root().append(d);
  const ch = echarts.init(d, null, { renderer });
  ch.setOption(o || opt());
  window.__ch = ch;
  return { d, ch };
};
const hoverAct = (d, ch) => {
  const p = ch.convertToPixel({ seriesIndex: 0 }, [2, 3]);
  const r = d.getBoundingClientRect();
  return [
    ["move", r.left + p[0] - 5, r.top + p[1]],
    ["move", r.left + p[0], r.top + p[1]],
    ["wait", 500],
  ];
};
const tip = () => {
  const t = [...document.querySelectorAll("#root div")].find((e) => e.textContent.includes("Series") || false);
  return null;
};
export const features = {
  canvas_line() {
    const { d } = mk("canvas");
    const c = d.querySelector("canvas");
    return { pixels: pixels(c), ...styleInfo(), canvasStyleAttr: c.getAttribute("style") };
  },
  svg_line() {
    const { d } = mk("svg");
    const s = d.querySelector("svg");
    return {
      svgNodes: nodes(s),
      paths: s.querySelectorAll("path").length,
      texts: [...s.querySelectorAll("text")].map((t) => t.textContent).join(","),
    };
  },
  legend_canvas() {
    const { ch } = mk("canvas");
    return {
      legendOpt: !!ch.getOption().legend,
      note: "legend drawn on canvas; see pixels",
      pixels: pixels(root().querySelector("canvas")),
    };
  },
  tooltip_html_default() {
    const { d, ch } = mk("canvas");
    window.__after = () => {
      const divs = [...d.querySelectorAll("div")];
      const tt = divs.find(
        (e) =>
          /A/.test(e.textContent) &&
          e.style.display !== "none" &&
          e.children.length >= 0 &&
          e.innerHTML.length > 0 &&
          e !== d.firstElementChild,
      );
      return { tooltipDivText: tt?.textContent, divCount: divs.length, ...styleInfo() };
    };
    return { actions: hoverAct(d, ch) };
  },
  tooltip_richText() {
    const { d, ch } = mk("canvas", opt({ tooltip: { trigger: "axis", renderMode: "richText" } }));
    window.__after = () => ({ divCount: d.querySelectorAll("div").length, pixels: pixels(d.querySelector("canvas")) });
    return { actions: hoverAct(d, ch) };
  },
  tooltip_richText_svg() {
    const { d, ch } = mk("svg", opt({ tooltip: { trigger: "axis", renderMode: "richText" } }));
    window.__after = () => ({
      svgTexts: [...d.querySelectorAll("svg text")].map((t) => t.textContent).join("|"),
      tooltipDivs: d.querySelectorAll("div").length,
    });
    return { actions: hoverAct(d, ch) };
  },
  tooltip_html_svg() {
    const { d, ch } = mk("svg");
    window.__after = () => ({
      divCount: d.querySelectorAll("div").length,
      tooltipText: [...d.querySelectorAll("div")]
        .map((x) => x.textContent)
        .join("|")
        .slice(0, 80),
    });
    return { actions: hoverAct(d, ch) };
  },
  tooltip_dom_formatter_svg() {
    const { d, ch } = mk(
      "svg",
      opt({
        tooltip: {
          trigger: "axis",
          formatter: () => {
            const e = document.createElement("div");
            e.textContent = "dom tip";
            return e;
          },
        },
      }),
    );
    window.__after = () => ({
      tooltipText: [...d.querySelectorAll("div")]
        .map((x) => x.textContent)
        .join("|")
        .slice(-40),
    });
    return { actions: hoverAct(d, ch) };
  },
  dataZoom() {
    const { d, ch } = mk("canvas", opt({ dataZoom: [{ type: "inside" }, { type: "slider" }] }));
    const c = d.querySelector("canvas");
    return { pixels: pixels(c), zoomOpt: ch.getOption().dataZoom.length };
  },
  dataZoom_wheel() {
    const { d, ch } = mk("canvas", opt({ dataZoom: [{ type: "inside" }] }));
    window.__after = () => ({ start: ch.getOption().dataZoom[0].start, end: ch.getOption().dataZoom[0].end });
    const r = d.getBoundingClientRect();
    return { actions: [["wheel", r.left + 250, r.top + 150, -300]] };
  },
  ssr_domparser_raw() {
    const c = echarts.init(null, null, { renderer: "svg", ssr: true, width: 400, height: 250 });
    c.setOption(opt());
    const s = c.renderToSVGString();
    const doc = new DOMParser().parseFromString(s, "image/svg+xml");
    root().append(doc.documentElement);
    return { svgLen: s.length, nodes: nodes(root()) };
  },
  ssr_domparser_keelpolicy() {
    const c = echarts.init(null, null, { renderer: "svg", ssr: true, width: 400, height: 250 });
    c.setOption(opt());
    const s = c.renderToSVGString();
    const p = window.__keelPolicy;
    const doc = new DOMParser().parseFromString(p.createHTML(s), "image/svg+xml");
    const imp = document.importNode(doc.documentElement, true);
    root().append(imp);
    return {
      svgLen: s.length,
      nodes: nodes(root()),
      paths: root().querySelectorAll("path").length,
      styleEls: root().querySelectorAll("style").length,
    };
  },
  async ssr_img_same_origin() {
    const c = echarts.init(null, null, { renderer: "svg", ssr: true, width: 400, height: 250 });
    c.setOption(opt());
    const s = c.renderToSVGString();
    const r = await fetch("/ssr.svg", { method: "PUT", body: s });
    const img = new Image();
    img.src = "/ssr.svg?" + Date.now();
    root().append(img);
    await new Promise((res) => {
      img.onload = res;
      img.onerror = res;
      setTimeout(res, 2000);
    });
    return { put: r.status, naturalWidth: img.naturalWidth, complete: img.complete };
  },
  async ssr_img_blob_url() {
    const c = echarts.init(null, null, { renderer: "svg", ssr: true, width: 400, height: 250 });
    c.setOption(opt());
    const s = c.renderToSVGString();
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
    root().append(img);
    await new Promise((res) => {
      img.onload = res;
      img.onerror = res;
      setTimeout(res, 2000);
    });
    return { naturalWidth: img.naturalWidth };
  },
  ssr_createElementNS() {
    const c = echarts.init(null, null, { renderer: "svg", ssr: true, width: 400, height: 250 });
    c.setOption(opt());
    const s = c.renderToSVGString();
    return { note: "no non-HTML parse route used; string only", len: s.length };
  },
};
