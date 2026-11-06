/** oxc parser language for a path (extension decides; unknown extensions parse as tsx). */
export function langOf(path: string): "js" | "jsx" | "ts" | "tsx" {
  if (/\.tsx$/.test(path)) return "tsx";
  if (/\.[cm]?ts$/.test(path)) return "ts";
  if (/\.jsx$/.test(path)) return "jsx";
  if (/\.[cm]?js$/.test(path)) return "js";
  return "tsx";
}
