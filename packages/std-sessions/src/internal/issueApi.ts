import { s } from "@keel/schema";
import type { ActionIo } from "./ActionIo.ts";

/** The open-issue fields the lookup reads (open objects: the rest is ignored); pull requests carry `pull_request`. */
const Listed = s.array(s.object({ number: s.int(), title: s.string(), pull_request: s.json().optional() }));
const Filed = s.object({ number: s.int() });
const NEXT = /<([^>]+)>;\s*rel="next"/;
const MAX_PAGES = 50;

type Got<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly why: string };
type Issue = { readonly number: number; readonly title: string };

/**
 * GitHub REST issue calls for `repo` (`owner/name`) at `api`, authorized by `token`, through `io.fetch`. `open(label)`
 * lists every open issue with `label`, following `Link: rel="next"` only while it stays under `api` (at most 50 pages
 * of 100), and drops pull requests. A failure is a reason without the token or a response body.
 */
export function issueApi(io: Pick<ActionIo, "fetch">, api: string, repo: string, token: string) {
  const base = `${api}/repos/${repo}/issues`;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "keel-session-action",
    "x-github-api-version": "2022-11-28",
  };
  const call = async (what: string, url: string, method: string, body?: unknown): Promise<Got<Response>> => {
    let res: Response;
    try {
      const init = { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
      res = await io.fetch(url, init);
    } catch {
      return { ok: false, why: `github ${what} unreachable` };
    }
    return res.ok ? { ok: true, value: res } : { ok: false, why: `github ${what} answered ${res.status}` };
  };
  const filed = async (what: string, url: string, method: string, body: unknown): Promise<Got<number>> => {
    const r = await call(what, url, method, body);
    if (!r.ok) return r;
    const n = Filed.parse(await r.value.json().catch(() => null));
    return n.ok ? { ok: true, value: n.value.number } : { ok: false, why: `github ${what} answered without a number` };
  };
  return {
    open: async (label: string): Promise<Got<Issue[]>> => {
      const out: Issue[] = [];
      let url: string | undefined = `${base}?state=open&labels=${encodeURIComponent(label)}&per_page=100`;
      for (let page = 0; url !== undefined && page < MAX_PAGES; page++) {
        const r = await call("issues list", url, "GET");
        if (!r.ok) return r;
        const list = Listed.parse(await r.value.json().catch(() => null));
        if (!list.ok) return { ok: false, why: "github issues list answered without a list" };
        for (const i of list.value) if (i.pull_request === undefined) out.push({ number: i.number, title: i.title });
        const next = NEXT.exec(r.value.headers.get("link") ?? "")?.[1];
        url = next?.startsWith(`${api}/`) ? next : undefined;
      }
      return { ok: true, value: out };
    },
    create: (label: string, title: string, body: string) =>
      filed("issue create", base, "POST", { title, body, labels: [label] }),
    update: (n: number, title: string, body: string) => filed("issue update", `${base}/${n}`, "PATCH", { title, body }),
    comment: (n: number, body: string) => filed("issue comment", `${base}/${n}/comments`, "POST", { body }),
  };
}
