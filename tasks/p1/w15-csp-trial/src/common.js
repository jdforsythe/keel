export const root = () => document.getElementById("root");
export const nodes = (el) => el.querySelectorAll("*").length;
export const pixels = (c) => {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
  return n;
};
export const styleInfo = () => ({
  styleEls: document.querySelectorAll("style").length,
  styleAttrs: document.querySelectorAll("[style]").length,
});
export const data = Array.from({ length: 12 }, (_, i) => ({
  x: i,
  y: Math.round(50 + 30 * Math.sin(i / 2) + i * 3),
  d: new Date(2024, i, 1),
}));
