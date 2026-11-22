import type { FileKind } from "./FileKind.ts";

const CODE = /\.[cm]?[jt]sx?$/;
const DTS = /\.d\.[cm]?ts$/;
/** k.check's test code, `conformance/` included: E1757 and the other app rules do not read it. */
const CHECK_TEST = /(?:^|\/)(?:test|tests|conformance|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const TEST = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const NOT_APP = /(?:^|\/)(?:unsafe|\.keel|node_modules)\/|\.config\.[cm]?[jt]sx?$/;
const SERVER = /\.(?:server|guard)(?:\.[^/.]+)*$/i;

/** How k.escapes reads `path`, a git-root path, given the git-root path of its project (`dir`, ending `/` or empty), or null. */
export function kindOf(path: string, dir: string | null): FileKind {
  const own = dir === null ? path : path.slice(dir.length);
  const name = own.slice(own.lastIndexOf("/") + 1);
  return {
    app: CODE.test(own) && !DTS.test(own) && !CHECK_TEST.test(own) && !NOT_APP.test(own),
    test: TEST.test(own),
    server: SERVER.test(name),
    unsafeDir: dir !== null && /(?:^|\/)unsafe\//.test(own) && !/(?:^|\/)node_modules\//.test(own),
    topology: dir !== null && own === "topology.ts",
  };
}
