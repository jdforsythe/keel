import * as Plot from "@observablehq/plot";
import { root, nodes, data, styleInfo } from "./common.js";
const base = () => [
  Plot.lineY(data, { x: "x", y: "y", stroke: "steelblue" }),
  Plot.dot(data, { x: "x", y: "y", fill: "red" }),
];
const info = (el) => ({
  svgNodes: nodes(el),
  circles: el.querySelectorAll("circle").length,
  paths: el.querySelectorAll("path").length,
  texts: el.querySelectorAll("text").length,
  styleElsInSvg: el.querySelectorAll("style").length,
  ...styleInfo(),
  svgStyleAttr: el.getAttribute("style"),
  svgFont: getComputedStyle(el).fontSize + " " + getComputedStyle(el).fontFamily,
  textAnchor: el.querySelector("text") && getComputedStyle(el.querySelector("text")).textAnchor,
});
export const features = {
  computed_look() {
    const el = Plot.plot({ marks: [Plot.axisX(), Plot.axisY(), ...base()] });
    root().append(el);
    const g = (e, p) => e && getComputedStyle(e)[p];
    const t = el.querySelector('[aria-label="x-axis tick label"] text');
    return {
      display: g(el, "display"),
      maxWidth: g(el, "maxWidth"),
      height: g(el, "height"),
      width: g(el, "width"),
      xTickTextAnchor: g(t, "textAnchor"),
      xTickTextFill: g(t, "fill"),
      svgW: el.getAttribute("width"),
      svgH: el.getAttribute("height"),
      bbox: JSON.stringify(el.getBoundingClientRect()),
    };
  },
  line_dot() {
    const el = Plot.plot({ marks: base() });
    root().append(el);
    return info(el);
  },
  axis() {
    const el = Plot.plot({ marks: [Plot.axisX({ label: "X" }), Plot.axisY({ label: "Y" }), ...base()] });
    root().append(el);
    return { ...info(el), ticks: el.querySelectorAll('[aria-label="x-axis tick"] *').length };
  },
  tip() {
    const el = Plot.plot({ marks: [Plot.dot(data, { x: "x", y: "y", fill: "red", r: 6, tip: true })] });
    root().append(el);
    window.__after = () => ({
      tipNodes: el.querySelectorAll('[aria-label="tip"]').length,
      tipText: el.querySelector('[aria-label="tip"]')?.textContent,
      ...styleInfo(),
    });
    const c = el.querySelector("circle").getBoundingClientRect();
    return {
      ...info(el),
      actions: [
        ["move", c.left + c.width / 2 - 4, c.top],
        ["move", c.left + c.width / 2, c.top + c.height / 2],
        ["wait", 300],
      ],
    };
  },
  legend_layout() {
    const el = Plot.legend({
      color: { type: "categorical", domain: ["a", "b", "c"], range: ["red", "green", "blue"] },
    });
    root().append(el);
    const g = (e, p) => getComputedStyle(e)[p];
    const sw = el.querySelector("span");
    return {
      display: g(el, "display"),
      fontSize: g(el, "fontSize"),
      swatchDisplay: sw && g(sw, "display"),
      rect: JSON.stringify(el.getBoundingClientRect()),
    };
  },
  legend() {
    const el = Plot.legend({
      color: { type: "categorical", domain: ["a", "b", "c"], range: ["red", "green", "blue"] },
    });
    root().append(el);
    const sw = [...el.querySelectorAll("*")];
    return {
      tag: el.tagName,
      nodes: nodes(el),
      styleEls: el.querySelectorAll("style").length,
      ...styleInfo(),
      swatchStyleAttrs: el.querySelectorAll("[style]").length,
      text: el.textContent,
      firstSwatchBg: el.querySelector("span") && getComputedStyle(el.querySelector("span")).backgroundColor,
      swatchSvgFill: el.querySelector("svg") && getComputedStyle(el.querySelector("svg")).fill,
      rects: el.querySelectorAll("rect").length,
    };
  },
  legend_ramp() {
    const el = Plot.legend({ color: { type: "linear", domain: [0, 10], scheme: "viridis" } });
    root().append(el);
    return {
      tag: el.tagName,
      nodes: nodes(el),
      styleEls: el.querySelectorAll("style").length,
      imgs: el.querySelectorAll("image").length,
      texts: el.querySelectorAll("text").length,
    };
  },
  plot_legend_option() {
    const el = Plot.plot({
      color: { legend: true, domain: ["a", "b"], range: ["red", "blue"] },
      marks: [Plot.dot(data, { x: "x", y: "y", fill: (d) => (d.x % 2 ? "a" : "b") })],
    });
    root().append(el);
    return {
      tag: el.tagName,
      ...info([...el.querySelectorAll("svg")].pop()),
      fig: el.tagName,
      styleElsInFigure: el.querySelectorAll("style").length,
    };
  },
  style_option() {
    const el = Plot.plot({ style: { background: "lightyellow", color: "darkgreen", fontSize: "14px" }, marks: base() });
    root().append(el);
    return { ...info(el), bg: getComputedStyle(el).backgroundColor, styleAttr: el.getAttribute("style") };
  },
  style_option_string() {
    const el = Plot.plot({ style: "background: lightyellow; font-size: 20px", marks: base() });
    root().append(el);
    return { ...info(el), bg: getComputedStyle(el).backgroundColor, styleAttr: el.getAttribute("style") };
  },
  async render_to_html_string() {
    const el = Plot.plot({ marks: base() });
    return {
      outerHTMLHasStyle: el.outerHTML.includes("<style"),
      len: el.outerHTML.length,
      firstChild: el.firstElementChild?.tagName,
    };
  },
};
