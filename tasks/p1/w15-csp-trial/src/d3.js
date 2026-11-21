import * as d3 from "d3";
import { root, nodes, data } from "./common.js";
const W = 500,
  H = 250;
const svgIn = () => {
  const s = d3.create("svg").attr("width", W).attr("height", H);
  root().append(s.node());
  return s;
};
const cs = (el, p) => getComputedStyle(el)[p];
export const features = {
  create_append_attr() {
    const s = svgIn();
    s.append("rect").attr("x", 10).attr("y", 10).attr("width", 100).attr("height", 50).attr("fill", "red");
    return { rects: root().querySelectorAll("rect").length, w: root().querySelector("rect").getAttribute("width") };
  },
  style_cssom() {
    const s = svgIn();
    const r = s.append("rect").attr("width", 100).attr("height", 50).style("fill", "rgb(0, 128, 0)");
    return { computedFill: cs(r.node(), "fill"), styleAttr: r.node().getAttribute("style") };
  },
  attr_style() {
    const s = svgIn();
    const r = s.append("rect").attr("width", 100).attr("height", 50).attr("style", "fill:rgb(0, 0, 255)");
    return { computedFill: cs(r.node(), "fill"), styleAttr: r.node().getAttribute("style") };
  },
  scales_axis() {
    const s = svgIn();
    const x = d3.scaleLinear([0, 11], [30, W - 10]);
    s.append("g")
      .attr("transform", `translate(0,${H - 30})`)
      .call(d3.axisBottom(x));
    return {
      ticks: root().querySelectorAll(".tick").length,
      text: [...root().querySelectorAll("text")].map((t) => t.textContent).join(","),
    };
  },
  line_area() {
    const s = svgIn();
    const x = d3.scaleLinear([0, 11], [10, W - 10]),
      y = d3.scaleLinear([0, 120], [H - 10, 10]);
    s.append("path")
      .attr(
        "d",
        d3
          .area()
          .x((d) => x(d.x))
          .y0(H - 10)
          .y1((d) => y(d.y))(data),
      )
      .attr("fill", "#ccc");
    s.append("path")
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr(
        "d",
        d3
          .line()
          .x((d) => x(d.x))
          .y((d) => y(d.y))(data),
      );
    return {
      paths: root().querySelectorAll("path").length,
      dLen: root().querySelector("path").getAttribute("d").length,
    };
  },
  async transition() {
    const s = svgIn();
    const r = s.append("rect").attr("width", 10).attr("height", 10).attr("x", 0).style("fill", "red");
    r.transition().duration(300).attr("x", 200).style("fill", "rgb(0, 0, 255)");
    await new Promise((r) => setTimeout(r, 600));
    return { x: r.attr("x"), fill: cs(r.node(), "fill") };
  },
  zoom() {
    const s = svgIn();
    const g = s.append("g");
    g.append("rect").attr("width", 100).attr("height", 100).attr("fill", "red");
    s.call(
      d3.zoom().on("zoom", (e) => {
        g.attr("transform", e.transform);
        window.__zoomed = e.transform.toString();
      }),
    );
    window.__after = () => ({ transform: g.attr("transform"), zoomed: window.__zoomed });
    return { actions: [["wheel", 200, 100, -300]] };
  },
  brush() {
    const s = svgIn();
    s.append("g").call(
      d3
        .brush()
        .extent([
          [0, 0],
          [W, H],
        ])
        .on("brush end", (e) => {
          window.__brush = JSON.stringify(e.selection);
        }),
    );
    window.__after = () => ({
      selection: window.__brush,
      brushNodes: nodes(root()),
      selectionRectW: root().querySelector(".selection")?.getAttribute("width"),
      selectionFill: cs(root().querySelector(".selection"), "fill"),
    });
    return { nodes: nodes(root()), actions: [["drag", 50, 50, 200, 150]] };
  },
  html() {
    const s = d3.select(root()).append("div");
    s.html("<b>x</b>");
    return { bold: root().querySelectorAll("b").length };
  },
  html_text() {
    const s = d3.select(root()).append("div");
    s.text("<b>x</b>");
    return { text: root().textContent };
  },
  format() {
    return { fmt: d3.format(",.2f")(12345.678), tf: d3.timeFormat("%Y-%m-%d")(new Date(2024, 0, 5)) };
  },
};
