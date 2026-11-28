/**
 * The file system views of a build-time evaluation bundle, part of `OBSERVE_BANNER` (k.evaluator Realm, Questions):
 * `__keelFs` and `__keelFsPromises`, Keel's own functions for each member `HOST_VIEWS` lists of `node:fs` and
 * `node:fs/promises`, each answered by a question to the command (`__keelAsk`), never by Node's `node:fs`, which the
 * evaluator cannot read with. What they return is of Keel's own classes: a stat result (`kind`, `size` and `mode` from
 * the answer, each other listed field asked when it is read, `atime` refused), a directory entry, a folder handle, a
 * file handle, a read stream (a `Readable` of `node:stream` whose constructor asks for the file's bytes). A descriptor
 * is the evaluation's own: `open` asks for the whole file, and a read by a descriptor it did not open is refused. A
 * write (a flag that writes), a recursive listing, and a member not listed are refused (E1050). A callback form calls
 * back on a later turn; a refusal throws at the call. `__keelReadText(path)` is a file's text, read as `readFileSync`
 * reads it. Written as one raw string: the code holds no template literal.
 */
export const FS_BANNER = String.raw`
const __keelPathOf = (x) => {
  if (typeof x === 'string') return x;
  if (x instanceof URL) { if (x.protocol !== 'file:') throw new TypeError('The URL must be of scheme file'); return __keelFileUrl(x); }
  if (x instanceof Uint8Array) return Buffer.from(x).toString('utf8');
  const e = new TypeError('The "path" argument must be of type string, Buffer or URL');
  e.code = 'ERR_INVALID_ARG_TYPE';
  throw e;
};
const __keelWrites = (f) => {
  if (f === undefined || f === null || typeof f === 'function') return false;
  if (typeof f === 'number') { const c = __keelCreateRequire(import.meta.url)('node:fs').constants; return (f & (c.O_WRONLY | c.O_RDWR | c.O_CREAT | c.O_TRUNC | c.O_APPEND)) !== 0; }
  return !['r', 'rs', 'sr'].includes(String(f));
};
const __keelFlagOf = (o) => (o !== null && typeof o === 'object' ? o.flag ?? o.flags : undefined);
const __keelBytes = (p) => Buffer.from(__keelAsk({ k: 'read', p }), 'base64');
const __keelReadText = (p) => __keelBytes(p).toString('utf8');
const __keelEnc = (o) => (typeof o === 'string' ? o : o !== null && typeof o === 'object' && typeof o.encoding === 'string' ? o.encoding : undefined);
const __keelLater = (f) => { setImmediate(f); };
const __keelCallback = (a) => { const cb = a[a.length - 1]; if (typeof cb !== 'function') { const e = new TypeError('The "cb" argument must be of type function'); e.code = 'ERR_INVALID_ARG_TYPE'; throw e; } return [cb, a.slice(0, -1)]; };
const __keelCb = (sync) => function (...a) {
  const [cb, rest] = __keelCallback(a);
  let r;
  try { r = sync(...rest); }
  catch (e) { if (__keelIsRefusal(e)) throw e; __keelLater(() => cb(e)); return; }
  __keelLater(() => (Array.isArray(r) && r.keelSpread === true ? cb(null, ...r) : cb(null, r)));
};
const __keelAsync = (sync) => function (...a) {
  let r;
  try { r = sync(...a); } catch (e) { if (__keelIsRefusal(e)) throw e; return Promise.reject(e); }
  return Promise.resolve(r);
};
const __keelSpread = (...v) => Object.assign(v, { keelSpread: true });
const __keelNsField = (ns) => { const n = BigInt(ns); return Number(n / 1000000n) + Number(n % 1000000n) / 1e6; };
class __KeelStats {
  #a; #of; #p; #big;
  constructor(a, of, p, big) { this.#a = a; this.#of = of; this.#p = p; this.#big = big === true; }
  #ask(f) { return __keelAsk({ k: 'field', of: this.#of, f, p: this.#p }); }
  #num(f) { const v = this.#ask(f); return this.#big ? BigInt(v) : Number(v); }
  #ms(f) { const v = this.#ask(f); return this.#big ? BigInt(v) / 1000000n : __keelNsField(v); }
  isFile() { return this.#a.kind === 'file'; }
  isDirectory() { return this.#a.kind === 'dir'; }
  isSymbolicLink() { return this.#a.kind === 'link'; }
  isBlockDevice() { return false; }
  isCharacterDevice() { return false; }
  isFIFO() { return false; }
  isSocket() { return false; }
  get size() { return this.#big ? BigInt(this.#a.size) : this.#a.size; }
  get mode() { return this.#big ? BigInt(this.#a.mode) : this.#a.mode; }
  get ino() { return this.#num('ino'); }
  get dev() { return this.#num('dev'); }
  get nlink() { return this.#num('nlink'); }
  get uid() { return this.#num('uid'); }
  get gid() { return this.#num('gid'); }
  get rdev() { return this.#num('rdev'); }
  get blksize() { return this.#num('blksize'); }
  get blocks() { return this.#num('blocks'); }
  get mtimeMs() { return this.#ms('mtimeNs'); }
  get ctimeMs() { return this.#ms('ctimeNs'); }
  get birthtimeMs() { return this.#ms('birthtimeNs'); }
  get mtimeNs() { return BigInt(this.#ask('mtimeNs')); }
  get ctimeNs() { return BigInt(this.#ask('ctimeNs')); }
  get birthtimeNs() { return BigInt(this.#ask('birthtimeNs')); }
  get mtime() { return new Date(__keelNsField(this.#ask('mtimeNs'))); }
  get ctime() { return new Date(__keelNsField(this.#ask('ctimeNs'))); }
  get birthtime() { return new Date(__keelNsField(this.#ask('birthtimeNs'))); }
  get atime() { return __keelRefuse('node:fs.Stats.atime'); }
  get atimeMs() { return __keelRefuse('node:fs.Stats.atimeMs'); }
  get atimeNs() { return __keelRefuse('node:fs.Stats.atimeNs'); }
}
class __KeelDirent {
  #kind;
  constructor(name, parent, kind) { this.name = name; this.parentPath = parent; this.path = parent; this.#kind = kind; }
  isFile() { return this.#kind === 'file'; }
  isDirectory() { return this.#kind === 'dir'; }
  isSymbolicLink() { return this.#kind === 'link'; }
  isBlockDevice() { return false; }
  isCharacterDevice() { return false; }
  isFIFO() { return false; }
  isSocket() { return false; }
}
const __keelStatOf = (kind, p, o) => {
  try { return new __KeelStats(__keelAsk({ k: kind, p }), kind, p, o !== null && typeof o === 'object' && o.bigint === true); }
  catch (e) { if (!__keelIsRefusal(e) && e.code === 'ENOENT' && o !== null && typeof o === 'object' && o.throwIfNoEntry === false) return undefined; throw e; }
};
const __keelList = (p, o) => {
  if (o !== null && typeof o === 'object' && o.recursive === true) __keelRefuse('a recursive folder listing');
  const rows = __keelAsk({ k: 'list', p });
  const enc = __keelEnc(o);
  if (o !== null && typeof o === 'object' && o.withFileTypes === true) return rows.map(([n, kind]) => new __KeelDirent(n, p, kind));
  return rows.map(([n]) => (enc === 'buffer' ? Buffer.from(n) : n));
};
const __keelFds = new Map();
let __keelNextFd = 1000;
const __keelMine = (fd) => { if (!__keelFds.has(fd)) __keelRefuse('a read by file descriptor ' + fd + ', which the evaluation did not open,'); return __keelFds.get(fd); };
const __keelOpen = (p, flags) => {
  if (__keelWrites(flags)) __keelRefuse('node:fs.open to write');
  const path = __keelPathOf(p);
  const bytes = __keelBytes(path);
  const fd = __keelNextFd++;
  __keelFds.set(fd, { path, bytes, pos: 0 });
  return fd;
};
const __keelReadInto = (fd, buffer, a, b, c) => {
  const f = __keelMine(fd);
  let offset = a, length = b, position = c;
  if (a !== null && typeof a === 'object') ({ offset = 0, length = buffer.byteLength - offset, position = null } = a);
  offset = offset ?? 0;
  length = length ?? buffer.byteLength - offset;
  const at = typeof position === 'number' || typeof position === 'bigint' ? Number(position) : f.pos;
  const n = Math.max(0, Math.min(length, f.bytes.length - at));
  const view = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.set(f.bytes.subarray(at, at + n), offset);
  if (!(typeof position === 'number' || typeof position === 'bigint')) f.pos += n;
  return n;
};
const __keelReadv = (fd, buffers, position) => {
  let total = 0;
  let at = typeof position === 'number' ? position : null;
  for (const b of buffers) { const n = __keelReadInto(fd, b, 0, b.byteLength, at); total += n; if (at !== null) at += n; if (n < b.byteLength) break; }
  return total;
};
const __keelReadFile = (p, o) => {
  if (__keelWrites(__keelFlagOf(o))) __keelRefuse('node:fs.readFile to write');
  let bytes;
  if (typeof p === 'number') { const f = __keelMine(p); bytes = f.bytes.subarray(f.pos); f.pos = f.bytes.length; }
  else bytes = __keelBytes(__keelPathOf(p));
  const enc = __keelEnc(o);
  return enc === undefined || enc === 'buffer' ? bytes : bytes.toString(enc);
};
const __keelExists = (p) => { let path; try { path = __keelPathOf(p); } catch { return false; } return __keelAsk({ k: 'exists', p: path }) === true; };
const __keelAccess = (p, m) => { __keelAsk({ k: 'access', p: __keelPathOf(p), m: typeof m === 'number' ? m : undefined }); };
const __keelRealpath = (p, o) => { const r = __keelAsk({ k: 'realpath', p: __keelPathOf(p) }); return __keelEnc(o) === 'buffer' ? Buffer.from(r) : r; };
const __keelReadlink = (p, o) => { const r = __keelAsk({ k: 'readlink', p: __keelPathOf(p) }); return __keelEnc(o) === 'buffer' ? Buffer.from(r) : r; };
const __keelReadable = __keelCreateRequire(import.meta.url)('node:stream').Readable;
class __KeelReadStream extends __keelReadable {
  #bytes; #err; #at; #end;
  constructor(p, o) {
    const opts = typeof o === 'string' ? { encoding: o } : o ?? {};
    if (__keelWrites(opts.flags ?? opts.flag)) __keelRefuse('node:fs.ReadStream to write');
    super({ highWaterMark: opts.highWaterMark ?? 65536, encoding: opts.encoding ?? null });
    this.bytesRead = 0;
    this.pending = false;
    try {
      if (opts.fd !== undefined && opts.fd !== null) {
        const fd = typeof opts.fd === 'object' ? opts.fd.fd : opts.fd;
        const f = __keelMine(fd);
        this.path = f.path;
        this.#bytes = f.bytes;
      } else {
        this.path = __keelPathOf(p);
        this.#bytes = __keelBytes(this.path);
      }
    } catch (e) {
      if (__keelIsRefusal(e)) throw e;
      this.#err = e;
      this.#bytes = Buffer.alloc(0);
    }
    this.#at = typeof opts.start === 'number' ? opts.start : 0;
    this.#end = typeof opts.end === 'number' ? Math.min(opts.end + 1, this.#bytes.length) : this.#bytes.length;
  }
  _construct(cb) { cb(this.#err ?? null); }
  _read(size) {
    if (this.#at >= this.#end) { this.push(null); return; }
    const chunk = this.#bytes.subarray(this.#at, Math.min(this.#end, this.#at + size));
    this.#at += chunk.length;
    this.bytesRead += chunk.length;
    this.push(Buffer.from(chunk));
  }
  close(cb) { this.destroy(); if (typeof cb === 'function') this.once('close', cb); }
}
const __keelLines = async function* (bytes) {
  const text = bytes.toString('utf8');
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  for (const l of lines) yield l;
};
class __KeelFileHandle {
  #fd;
  constructor(fd) { this.#fd = fd; }
  get fd() { return this.#fd; }
  async read(a, b, c, d) {
    if (a === undefined || a === null || (typeof a === 'object' && !(a instanceof Uint8Array) && !ArrayBuffer.isView(a))) {
      const o = a ?? {};
      const buffer = o.buffer ?? Buffer.alloc(16384);
      const bytesRead = __keelReadInto(this.#fd, buffer, o.offset ?? 0, o.length ?? buffer.byteLength - (o.offset ?? 0), o.position ?? null);
      return { bytesRead, buffer };
    }
    const bytesRead = __keelReadInto(this.#fd, a, b, c, d);
    return { bytesRead, buffer: a };
  }
  async readv(buffers, position) { return { bytesRead: __keelReadv(this.#fd, buffers, position), buffers }; }
  async readFile(o) { return __keelReadFile(this.#fd, o); }
  readLines() { const f = __keelMine(this.#fd); const rest = f.bytes.subarray(f.pos); f.pos = f.bytes.length; return __keelLines(rest); }
  createReadStream(o) { return new __KeelReadStream(undefined, { ...(o ?? {}), fd: this.#fd }); }
  readableWebStream() { const f = __keelMine(this.#fd); const rest = new Uint8Array(f.bytes.subarray(f.pos)); f.pos = f.bytes.length; return new ReadableStream({ start(c) { c.enqueue(rest); c.close(); } }); }
  async stat(o) { return __keelStatOf('stat', __keelMine(this.#fd).path, o); }
  async close() { __keelFds.delete(this.#fd); }
  write() {}
  writev() {}
  writeFile() {}
  appendFile() {}
  truncate() {}
  chmod() {}
  chown() {}
  utimes() {}
  sync() {}
  datasync() {}
}
const __keelHandle = (fd) => __keelView('FileHandle', new __KeelFileHandle(fd), __keelHost.fileHandle, {
  bound: (k, real) => { const m = Reflect.get(real, k); return typeof m === 'function' ? m.bind(real) : m; },
  fstat: (k, real) => function (o) { return real.stat(o); },
});
class __KeelDir {
  #rows; #i = 0;
  constructor(p, rows) { this.path = p; this.#rows = rows; }
  readSync() { return this.#i < this.#rows.length ? this.#rows[this.#i++] : null; }
  read(cb) { const v = this.readSync(); if (typeof cb === 'function') { __keelLater(() => cb(null, v)); return undefined; } return Promise.resolve(v); }
  closeSync() {}
  close(cb) { if (typeof cb === 'function') { __keelLater(() => cb(null)); return undefined; } return Promise.resolve(); }
  async *[Symbol.asyncIterator]() { for (let v = this.readSync(); v !== null; v = this.readSync()) yield v; }
  *entries() { for (let v = this.readSync(); v !== null; v = this.readSync()) yield v; }
}
const __keelOpendir = (p) => { const path = __keelPathOf(p); return new __KeelDir(path, __keelList(path, { withFileTypes: true })); };
const __keelStatSync = (p, o) => __keelStatOf('stat', __keelPathOf(p), o);
const __keelLstatSync = (p, o) => __keelStatOf('lstat', __keelPathOf(p), o);
const __keelFstat = (fd, o) => __keelStatOf('stat', __keelMine(fd).path, o);
const __keelReaddir = (p, o) => __keelList(__keelPathOf(p), o);
const __keelRealpathSync = Object.assign((p, o) => __keelRealpath(p, o), { native: (p, o) => __keelRealpath(p, o) });
const __keelRealpathCb = Object.assign(__keelCb(__keelRealpath), { native: __keelCb(__keelRealpath) });
const __keelFs = {
  readFileSync: __keelReadFile,
  readFile: __keelCb(__keelReadFile),
  openAsBlob: (p, o) => { try { return Promise.resolve(new Blob([__keelBytes(__keelPathOf(p))], { type: o?.type ?? '' })); } catch (e) { if (__keelIsRefusal(e)) throw e; return Promise.reject(e); } },
  openSync: (p, flags) => __keelOpen(p, flags),
  open: function (p, ...a) { const [cb, rest] = __keelCallback(a); if (__keelWrites(rest[0])) __keelRefuse('node:fs.open to write'); return __keelCb((x) => __keelOpen(x, rest[0]))(p, cb); },
  createReadStream: (p, o) => new __KeelReadStream(p, o),
  readSync: (fd, buffer, a, b, c) => __keelReadInto(fd, buffer, a, b, c),
  read: function (fd, ...a) {
    const [cb, rest] = __keelCallback(a);
    let buffer = rest[0];
    let args = rest.slice(1);
    if (buffer === undefined || (typeof buffer === 'object' && !ArrayBuffer.isView(buffer))) { const o = buffer ?? {}; buffer = o.buffer ?? Buffer.alloc(16384); args = [o.offset ?? 0, o.length, o.position ?? null]; }
    return __keelCb(() => __keelSpread(__keelReadInto(fd, buffer, ...args), buffer))(cb);
  },
  readvSync: (fd, buffers, position) => __keelReadv(fd, buffers, position),
  readv: function (fd, buffers, ...a) { const [cb, rest] = __keelCallback(a); return __keelCb(() => __keelSpread(__keelReadv(fd, buffers, rest[0]), buffers))(cb); },
  fstatSync: __keelFstat,
  fstat: __keelCb(__keelFstat),
  closeSync: (fd) => { __keelMine(fd); __keelFds.delete(fd); },
  close: function (fd, cb) { __keelMine(fd); __keelFds.delete(fd); if (typeof cb === 'function') __keelLater(() => cb(null)); },
  existsSync: __keelExists,
  exists: function (p, cb) { const v = __keelExists(p); __keelLater(() => cb(v)); },
  statSync: __keelStatSync,
  stat: __keelCb(__keelStatSync),
  lstatSync: __keelLstatSync,
  lstat: __keelCb(__keelLstatSync),
  accessSync: __keelAccess,
  access: __keelCb(__keelAccess),
  realpathSync: __keelRealpathSync,
  realpath: __keelRealpathCb,
  readlinkSync: __keelReadlink,
  readlink: __keelCb(__keelReadlink),
  readdirSync: __keelReaddir,
  readdir: __keelCb(__keelReaddir),
  opendirSync: __keelOpendir,
  opendir: __keelCb(__keelOpendir),
};
const __keelFsPromises = {
  readFile: (p, o) => (p instanceof __KeelFileHandle ? p.readFile(o) : __keelAsync(__keelReadFile)(p, o)),
  open: (p, flags) => { if (__keelWrites(flags)) __keelRefuse('node:fs/promises.open to write'); return __keelAsync((x) => __keelHandle(__keelOpen(x, flags)))(p); },
  stat: __keelAsync(__keelStatSync),
  lstat: __keelAsync(__keelLstatSync),
  access: __keelAsync(__keelAccess),
  realpath: __keelAsync(__keelRealpath),
  readlink: __keelAsync(__keelReadlink),
  readdir: __keelAsync(__keelReaddir),
  opendir: __keelAsync(__keelOpendir),
};
`;
