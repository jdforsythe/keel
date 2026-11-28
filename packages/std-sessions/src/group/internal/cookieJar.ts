type Cookie = {
  readonly name: string;
  readonly value: string;
  readonly path: string;
  readonly secure: boolean;
  /** When it runs out on the jar's clock (ms); undefined for a session cookie. */
  readonly expires: number | undefined;
  readonly order: number;
};

/** The default path of a request path (RFC 6265 5.1.4): its directory, or `/`. */
const defaultPath = (path: string): string => {
  const cut = path.lastIndexOf("/");
  return path.startsWith("/") && cut > 0 ? path.slice(0, cut) : "/";
};

/** Whether `path` is under cookie path `under` (RFC 6265 5.1.4). */
const pathMatch = (path: string, under: string): boolean =>
  path === under || (path.startsWith(under) && (under.endsWith("/") || path[under.length] === "/"));

/**
 * One group user's cookie jar (std.multi), keeping what a browser at a sim origin would, on the clock `now` (ms):
 * `store` takes the `Set-Cookie` lines of a response to `url`; `header` is the `Cookie` value for a request to `url`.
 * A cookie is deleted by `Max-Age` of 0 or less, or an `Expires` not after `now`, and runs out at its `Max-Age`
 * (before `Expires`); `Path` (default: the request's directory) limits where it goes; a `Secure` cookie is set and
 * sent over https only; a `__Secure-` name needs `Secure`, and a `__Host-` name also `Path=/` and no `Domain`; a
 * `Domain` the request's host is not under drops the cookie. Most specific path first, then oldest first.
 */
export function cookieJar(now: () => number): {
  store(url: string, lines: readonly string[]): void;
  header(url: string): string;
} {
  const jar = new Map<string, Cookie>();
  let made = 0;
  const live = (c: Cookie): boolean => c.expires === undefined || c.expires > now();
  return {
    store(url, lines) {
      const at = new URL(url);
      const https = at.protocol === "https:";
      for (const line of lines) {
        const [pair = "", ...attrs] = line.split(";");
        const eq = pair.indexOf("=");
        const name = eq > 0 ? pair.slice(0, eq).trim() : "";
        if (name === "") continue;
        let path = defaultPath(at.pathname);
        let secure = false;
        let domain: string | undefined;
        let maxAge: number | undefined;
        let expires: number | undefined;
        for (const attr of attrs) {
          const i = attr.indexOf("=");
          const key = (i < 0 ? attr : attr.slice(0, i)).trim().toLowerCase();
          const v = i < 0 ? "" : attr.slice(i + 1).trim();
          if (key === "path" && v.startsWith("/")) path = v;
          else if (key === "secure") secure = true;
          else if (key === "domain" && v !== "") domain = v.replace(/^\./, "").toLowerCase();
          else if (key === "max-age" && /^-?\d+$/.test(v)) maxAge = Number(v);
          else if (key === "expires" && !Number.isNaN(Date.parse(v))) expires = Date.parse(v);
        }
        const host = at.hostname.toLowerCase();
        if (domain !== undefined && host !== domain && !host.endsWith(`.${domain}`)) continue;
        if (secure && !https) continue;
        if (name.startsWith("__Secure-") && !secure) continue;
        if (name.startsWith("__Host-") && (!secure || path !== "/" || domain !== undefined)) continue;
        const until = maxAge === undefined ? expires : maxAge <= 0 ? Number.NEGATIVE_INFINITY : now() + maxAge * 1000;
        const key = `${name};${path}`;
        const old = jar.get(key);
        const cookie = {
          name,
          value: pair.slice(eq + 1).trim(),
          path,
          secure,
          expires: until,
          order: old?.order ?? made++,
        };
        if (live(cookie)) jar.set(key, cookie);
        else jar.delete(key);
      }
    },
    header(url) {
      const at = new URL(url);
      const https = at.protocol === "https:";
      return [...jar.values()]
        .filter((c) => live(c) && (https || !c.secure) && pathMatch(at.pathname, c.path))
        .sort((a, b) => b.path.length - a.path.length || a.order - b.order)
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
    },
  };
}
