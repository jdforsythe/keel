import ts from "typescript";

/** What a claimed type holds that the body does not prove (k.identity Rules), in the rule's order. */
type What = `property ${string}` | "a call signature" | "a type parameter" | "a type argument" | "its whole type";

/** A failed proof: the first property path (from the subject) a structural proof left unproven, when there is one. */
type Gap = { readonly prop: string | undefined };

/** The kernel guards (k.identity Identity): each is true only of a value its maker returned in this realm. */
const KERNEL_GUARDS = new Set(["isSchema", "isObjectSchema", "isDefect", "isStore", "isTransaction", "isRouteTable"]);
/** A kernel package's record of what its makers made (k.identity): the binding of its `internal/records.ts` or `refusals.ts`. */
const RECORD_FILE =
  /[\\/](?:packages|@keel)[\\/](?:schema|store|router|server)[\\/](?:src|dist[\\/]src)[\\/]internal[\\/](?:records|refusals)\.(?:ts|d\.ts|js)$/;
const KERNEL_FILE = /[\\/](?:packages|@keel)[\\/](?:schema|store|router)[\\/]/;
const SCHEMA_FILE = /[\\/](?:packages|@keel)[\\/]schema[\\/]/;
const NODE_TYPES = /[\\/]@types[\\/]node[\\/]/;
const PACKAGE_DIR = /[\\/]packages[\\/]([^\\/]+)[\\/]/;
const SET_METHODS = new Set(["has", "add", "delete"]);
const OPEN = ts.TypeFlags.Any | ts.TypeFlags.Unknown;

const bare = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) ? bare(e.expression) : e);

/** `e` when it is a binary expression of `op`, else `undefined`. */
const opOf = (e: ts.Expression, op: ts.SyntaxKind): ts.BinaryExpression | undefined =>
  ts.isBinaryExpression(e) && e.operatorToken.kind === op ? e : undefined;

/** A comparison's operands, each way round. */
const sides = (e: ts.BinaryExpression): readonly (readonly [ts.Expression, ts.Expression])[] => [
  [e.left, e.right],
  [e.right, e.left],
];

/** The operands of an `op` chain (`&&` or `||`), parentheses aside. */
function chainOf(e: ts.Expression, op: ts.SyntaxKind): ts.Expression[] {
  const b = bare(e);
  const o = opOf(b, op);
  return o === undefined ? [b] : [...chainOf(o.left, op), ...chainOf(o.right, op)];
}
const ands = (e: ts.Expression): ts.Expression[] => chainOf(e, ts.SyntaxKind.AmpersandAmpersandToken);
const ors = (e: ts.Expression): ts.Expression[] => chainOf(e, ts.SyntaxKind.BarBarToken);

/** `n` when it is a function with a body whose return type is a type predicate or an assertion. */
function predicateOf(n: ts.Node): { fn: ts.FunctionLikeDeclaration; pred: ts.TypePredicateNode } | undefined {
  const fn =
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
      ? n
      : undefined;
  const pred = fn?.type;
  if (fn === undefined || fn.body === undefined || pred === undefined || !ts.isTypePredicateNode(pred))
    return undefined;
  return { fn, pred };
}

/** Whether `s` is a call of `defect`, as a statement or a block holding only it. */
function isDefectStatement(s: ts.Statement): boolean {
  if (ts.isBlock(s)) {
    const [only] = s.statements;
    return s.statements.length === 1 && only !== undefined && isDefectStatement(only);
  }
  if (!ts.isExpressionStatement(s)) return false;
  const c = bare(s.expression);
  return ts.isCallExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === "defect";
}

/** The `P` of the body: `return P` (an arrow's expression), or for an assertion `if (!(P)) defect(...)`. */
function proofOf(fn: ts.FunctionLikeDeclaration, asserts: boolean): ts.Expression | undefined {
  const body = fn.body;
  if (body === undefined) return undefined;
  if (!ts.isBlock(body)) return asserts ? undefined : body;
  const [only] = body.statements;
  if (body.statements.length !== 1 || only === undefined) return undefined;
  if (!asserts) return ts.isReturnStatement(only) ? only.expression : undefined;
  if (!ts.isIfStatement(only) || only.elseStatement !== undefined || !isDefectStatement(only.thenStatement))
    return undefined;
  const cond = bare(only.expression);
  return ts.isPrefixUnaryExpression(cond) && cond.operator === ts.SyntaxKind.ExclamationToken
    ? cond.operand
    : undefined;
}

/** The string of a string literal or a template with no substitution, else `undefined`. */
const textOf = (e: ts.Expression | undefined): string | undefined => {
  const b = e === undefined ? undefined : bare(e);
  return b !== undefined && ts.isStringLiteralLike(b) ? b.text : undefined;
};

/** Whether `e` is `Reflect.get`, `Object.hasOwn` and the like: `<object>.<member>`. */
const isMember = (e: ts.Expression, object: string, member: string): boolean => {
  const b = bare(e);
  return (
    ts.isPropertyAccessExpression(b) &&
    ts.isIdentifier(b.expression) &&
    b.expression.text === object &&
    b.name.text === member
  );
};

/**
 * E1762 (k.identity Proven predicates): the type predicates and assertion functions of `sf` (declarations, function
 * expressions, arrow functions and methods with a body) whose body is none of the five proofs: identity by a kernel
 * guard or a predicate this rule accepts, an owned or built-in class's `instanceof`, the module's own `WeakSet` whose
 * every `add` is of the claimed type, a schema's `parse(x).ok`, and structure for a type with no signature and no type
 * parameter of the predicate. The body is `return P` (an arrow's expression), or for an assertion
 * `if (!(P)) defect(...)`; `P` is an `&&` chain. Each finding is at the return type, its message
 * `type predicate claims <what> it does not prove: check it, or use unsafe()`.
 */
export function unprovenPredicates(sf: ts.SourceFile, checker: ts.TypeChecker): { at: number; message: string }[] {
  const resolved = (s: ts.Symbol): ts.Symbol =>
    (s.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(s) : s;
  const assignable = (from: ts.Type, to: ts.Type): boolean => checker.isTypeAssignableTo(from, to);
  const members = (t: ts.Type): readonly ts.Type[] => (t.isUnion() ? t.types : [t]);

  /** Whether `type`, read to any depth, holds a part `test` accepts (properties, index, union and alias members). */
  const holds = (start: ts.Type, test: (t: ts.Type) => boolean): boolean => {
    const seen = new Set<ts.Type>();
    const walk = (type: ts.Type): boolean => {
      if (seen.has(type)) return false;
      seen.add(type);
      if (test(type)) return true;
      if ((type.aliasTypeArguments ?? []).some(walk)) return true;
      if (type.isUnionOrIntersection()) return type.types.some(walk);
      if ((type.flags & ts.TypeFlags.Object) === 0) return false;
      const elements = checker.isArrayType(type) || checker.isTupleType(type);
      if (!elements && checker.getPropertiesOfType(type).some((p) => walk(checker.getTypeOfSymbol(p)))) return true;
      return checker.getIndexInfosOfType(type).some((info) => walk(info.type));
    };
    return walk(start);
  };

  /** Whether `sig` claims more than that a value can be called: a parameter, or a return other than `void`. */
  const claimsMore = (sig: ts.Signature): boolean =>
    sig.getParameters().length > 0 || (checker.getReturnTypeOfSignature(sig).flags & (ts.TypeFlags.Void | OPEN)) === 0;
  const signatureMemo = new Map<ts.Type, boolean>();
  const holdsSignature = (t: ts.Type): boolean => {
    const known = signatureMemo.get(t);
    if (known !== undefined) return known;
    const r = holds(
      t,
      (type) =>
        (type.flags & ts.TypeFlags.Object) !== 0 &&
        !checker.isArrayType(type) &&
        !checker.isTupleType(type) &&
        (checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0 ||
          checker.getSignaturesOfType(type, ts.SignatureKind.Call).some(claimsMore)),
    );
    signatureMemo.set(t, r);
    return r;
  };
  /** Whether `t` is what `typeof v === 'function'` proves: callable, with no parameter, property or construct. */
  const plainCallable = (t: ts.Type): boolean => {
    const calls = checker.getSignaturesOfType(t, ts.SignatureKind.Call);
    return (
      calls.length > 0 &&
      !calls.some(claimsMore) &&
      checker.getSignaturesOfType(t, ts.SignatureKind.Construct).length === 0 &&
      checker.getPropertiesOfType(t).length === 0
    );
  };

  /** The package folder of a file in this repository (`packages/<name>/`), else `undefined`. */
  const packageOf = (file: string): string | undefined => PACKAGE_DIR.exec(file)?.[1];
  const isBuiltIn = (d: ts.Declaration): boolean => {
    const f = d.getSourceFile();
    return f.hasNoDefaultLib || NODE_TYPES.test(f.fileName);
  };

  type Judge = { readonly what: What | undefined };
  const judged = new Map<ts.Node, Judge | "pending">();

  /** Whether the function declaring `sig` is a kernel guard, or a predicate this rule accepts at its declaration. */
  const accepted = (decl: ts.Declaration | undefined): boolean => {
    if (decl === undefined) return false;
    const file = decl.getSourceFile();
    const name = ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl) ? decl.name : undefined;
    const bound = ts.isVariableDeclaration(decl.parent) ? decl.parent.name : undefined;
    const named = name ?? bound;
    if (
      named !== undefined &&
      ts.isIdentifier(named) &&
      KERNEL_GUARDS.has(named.text) &&
      KERNEL_FILE.test(file.fileName)
    )
      return true;
    if (file.isDeclarationFile) return false;
    const found = predicateOf(decl);
    return found !== undefined && judge(found.fn, found.pred, file) === undefined;
  };

  /** Judges one predicate: `undefined` when its body is a proof, else what it claims unproven. */
  const judge = (fn: ts.FunctionLikeDeclaration, pred: ts.TypePredicateNode, file: ts.SourceFile): What | undefined => {
    const memo = judged.get(fn);
    if (memo === "pending") return undefined;
    if (memo !== undefined) return memo.what;
    judged.set(fn, "pending");
    const what = judgeOnce(fn, pred, file);
    judged.set(fn, { what });
    return what;
  };

  const judgeOnce = (
    fn: ts.FunctionLikeDeclaration,
    pred: ts.TypePredicateNode,
    file: ts.SourceFile,
  ): What | undefined => {
    const asserts = pred.assertsModifier !== undefined;
    const p = proofOf(fn, asserts);
    if (p === undefined) return "its whole type";
    const name = pred.parameterName;
    const param = ts.isIdentifier(name)
      ? fn.parameters.find((q) => ts.isIdentifier(q.name) && q.name.text === name.text)
      : undefined;
    const paramSym = param === undefined ? undefined : checker.getSymbolAtLocation(param.name);
    const root: Root = ts.isIdentifier(name) ? { kind: "param", sym: paramSym } : { kind: "this" };
    const ownParams = new Set((fn.typeParameters ?? []).map((tp) => checker.getTypeAtLocation(tp)));
    const proof = prover(root, ownParams, file);
    const conjs = ands(p);
    if (pred.type === undefined) return conjs.some((c) => proof.subjectOf(c) === "") ? undefined : "its whole type";
    const t = checker.getTypeFromTypeNode(pred.type);
    const gap = proof.chain(conjs, "", t, false);
    if (gap === undefined) return undefined;
    if (conjs.some((c) => proof.classMismatch(c, t))) return "a type argument";
    if (holdsSignature(t)) return "a call signature";
    if (proof.holdsParam(t)) return "a type parameter";
    if (gap.prop !== undefined) return `property ${gap.prop}`;
    return "its whole type";
  };

  type Root = { readonly kind: "param"; readonly sym: ts.Symbol | undefined } | { readonly kind: "this" };

  const ownSetMemo = new Map<ts.Symbol, readonly ts.Expression[] | undefined>();
  /** The `add` arguments of `b` when it names its file's own module-level `WeakSet` (proof 3), else `undefined`. */
  const ownSet = (b: ts.Expression, file: ts.SourceFile): readonly ts.Expression[] | undefined => {
    const id = bare(b);
    const sym = ts.isIdentifier(id) ? checker.getSymbolAtLocation(id) : undefined;
    if (sym === undefined) return undefined;
    if (ownSetMemo.has(sym)) return ownSetMemo.get(sym);
    const adds = readOwnSet(sym, file);
    ownSetMemo.set(sym, adds);
    return adds;
  };
  const readOwnSet = (sym: ts.Symbol, file: ts.SourceFile): readonly ts.Expression[] | undefined => {
    const decl = sym.valueDeclaration;
    if (decl === undefined || !ts.isVariableDeclaration(decl) || !ts.isIdentifier(decl.name)) return undefined;
    if (decl.getSourceFile() !== file || (decl.parent.flags & ts.NodeFlags.Const) === 0) return undefined;
    const st = decl.parent.parent;
    if (!ts.isVariableStatement(st) || st.parent !== file) return undefined;
    if ((st.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return undefined;
    const init = decl.initializer === undefined ? undefined : bare(decl.initializer);
    const builtInSet =
      init !== undefined &&
      ts.isNewExpression(init) &&
      ts.isIdentifier(init.expression) &&
      init.expression.text === "WeakSet" &&
      (checker.getSymbolAtLocation(init.expression)?.declarations ?? []).some(isBuiltIn);
    if (!builtInSet) return undefined;
    const adds: ts.Expression[] = [];
    let open = false;
    const walk = (n: ts.Node): void => {
      if (open) return;
      if (ts.isIdentifier(n) && n !== decl.name && n.text === decl.name.getText(file)) {
        const at = checker.getSymbolAtLocation(n);
        const same =
          at !== undefined && (at === sym || resolved(at) === sym || checker.getExportSymbolOfSymbol(at) === sym);
        if (same || ts.isExportSpecifier(n.parent) || ts.isExportAssignment(n.parent)) {
          const access = n.parent;
          const call = access.parent;
          const used =
            ts.isPropertyAccessExpression(access) &&
            access.expression === n &&
            SET_METHODS.has(access.name.text) &&
            call !== undefined &&
            ts.isCallExpression(call) &&
            call.expression === access;
          if (!used) {
            open = true;
            return;
          }
          if (access.name.text === "add") {
            const [v] = call.arguments;
            if (v === undefined) open = true;
            else adds.push(v);
          }
        }
      }
      ts.forEachChild(n, walk);
    };
    walk(file);
    return open ? undefined : adds;
  };

  /** The proofs over one predicate's subject: its parameter (or `this`), read in `file`. */
  const prover = (root: Root, ownParams: ReadonlySet<ts.Type>, file: ts.SourceFile) => {
    const holdsParam = (t: ts.Type): boolean =>
      ownParams.size > 0 && holds(t, (type) => (type.flags & ts.TypeFlags.TypeParameter) !== 0 && ownParams.has(type));

    /** The path of `e` from the subject (`""`, `.a`, `.a.b`), through `.p`, `['p']` and `Reflect.get(v, 'p')`. */
    const subjectOf = (e: ts.Expression): string | undefined => {
      const b = bare(e);
      if (root.kind === "this" && b.kind === ts.SyntaxKind.ThisKeyword) return "";
      if (ts.isIdentifier(b))
        return root.kind === "param" && root.sym !== undefined && checker.getSymbolAtLocation(b) === root.sym
          ? ""
          : undefined;
      if (ts.isPropertyAccessExpression(b) && ts.isIdentifier(b.name)) {
        const base = subjectOf(b.expression);
        return base === undefined ? undefined : `${base}.${b.name.text}`;
      }
      if (ts.isElementAccessExpression(b)) {
        const key = textOf(b.argumentExpression);
        const base = subjectOf(b.expression);
        return base === undefined || key === undefined ? undefined : `${base}.${key}`;
      }
      if (ts.isCallExpression(b) && isMember(b.expression, "Reflect", "get") && b.arguments.length === 2) {
        const [obj, k] = b.arguments;
        const base = obj === undefined ? undefined : subjectOf(obj);
        const key = textOf(k);
        return base === undefined || key === undefined ? undefined : `${base}.${key}`;
      }
      return undefined;
    };
    const on = (e: ts.Expression | undefined, s: string): boolean => e !== undefined && subjectOf(e) === s;

    /** The literal `typeof <s> === '<kind>'` names, either way round, else `undefined`. */
    const typeofOf = (e: ts.Expression, s: string): string | undefined => {
      const eq = opOf(e, ts.SyntaxKind.EqualsEqualsEqualsToken) ?? opOf(e, ts.SyntaxKind.EqualsEqualsToken);
      if (eq === undefined) return undefined;
      for (const [a, k] of sides(eq)) {
        const ta = bare(a);
        const kind = textOf(k);
        if (ts.isTypeOfExpression(ta) && kind !== undefined && on(ta.expression, s)) return kind;
      }
      return undefined;
    };
    /** The literal `<s> === <literal>` compares to, either way round, else `undefined`. */
    const literalOf = (e: ts.Expression, s: string): ts.Expression | undefined => {
      const eq = opOf(e, ts.SyntaxKind.EqualsEqualsEqualsToken);
      if (eq === undefined) return undefined;
      for (const [a, l] of sides(eq)) {
        const lit = bare(l);
        const isLit =
          ts.isStringLiteralLike(lit) ||
          ts.isNumericLiteral(lit) ||
          ts.isBigIntLiteral(lit) ||
          lit.kind === ts.SyntaxKind.TrueKeyword ||
          lit.kind === ts.SyntaxKind.FalseKeyword ||
          lit.kind === ts.SyntaxKind.NullKeyword ||
          (ts.isIdentifier(lit) && lit.text === "undefined") ||
          (ts.isPrefixUnaryExpression(lit) &&
            lit.operator === ts.SyntaxKind.MinusToken &&
            ts.isNumericLiteral(lit.operand));
        if (isLit && on(a, s)) return lit;
      }
      return undefined;
    };
    const isUndefinedCheck = (e: ts.Expression, s: string): boolean => {
      const lit = literalOf(bare(e), s);
      return (
        typeofOf(bare(e), s) === "undefined" || (lit !== undefined && ts.isIdentifier(lit) && lit.text === "undefined")
      );
    };
    const isNotNull = (e: ts.Expression, s: string): boolean => {
      const ne = opOf(e, ts.SyntaxKind.ExclamationEqualsEqualsToken) ?? opOf(e, ts.SyntaxKind.ExclamationEqualsToken);
      return ne !== undefined && sides(ne).some(([a, n]) => on(a, s) && bare(n).kind === ts.SyntaxKind.NullKeyword);
    };
    /** `'p' in <base>` or `Object.hasOwn(<base>, 'p')` for the path `sub`. */
    const isKeyed = (e: ts.Expression, sub: string): boolean => {
      const cut = sub.lastIndexOf(".");
      const base = sub.slice(0, cut);
      const key = sub.slice(cut + 1);
      const inOp = opOf(e, ts.SyntaxKind.InKeyword);
      if (inOp !== undefined) return textOf(inOp.left) === key && on(inOp.right, base);
      if (!ts.isCallExpression(e) || !isMember(e.expression, "Object", "hasOwn")) return false;
      const [o, k] = e.arguments;
      return on(o, base) && textOf(k) === key;
    };
    const primitiveOf = (kind: string): ts.Type | undefined =>
      kind === "string"
        ? checker.getStringType()
        : kind === "number"
          ? checker.getNumberType()
          : kind === "bigint"
            ? checker.getBigIntType()
            : kind === "boolean"
              ? checker.getBooleanType()
              : kind === "symbol"
                ? checker.getESSymbolType()
                : kind === "undefined"
                  ? checker.getUndefinedType()
                  : undefined;

    /** The class an `instanceof` names, when the package declares it or it is built in, with its declared type. */
    const classOf = (e: ts.Expression, s: string): ts.Type | undefined => {
      const io = opOf(e, ts.SyntaxKind.InstanceOfKeyword);
      if (io === undefined || !on(io.left, s)) return undefined;
      const at = checker.getSymbolAtLocation(bare(io.right));
      const sym = at === undefined ? undefined : resolved(at);
      const decls = sym?.declarations ?? [];
      if (sym === undefined) return undefined;
      const here = packageOf(file.fileName);
      const owned = decls.some((d) => {
        const f = d.getSourceFile();
        return (
          (ts.isClassDeclaration(d) || ts.isClassExpression(d)) &&
          !f.isDeclarationFile &&
          !/[\\/]node_modules[\\/]/.test(f.fileName) &&
          packageOf(f.fileName) === here
        );
      });
      if (!owned && !decls.some(isBuiltIn)) return undefined;
      return checker.getDeclaredTypeOfSymbol(sym);
    };
    /** Whether `e` is a kernel package's record (`records.<name>`, `refusals`), a kernel guard's own proof. */
    const isRecord = (e: ts.Expression): boolean => {
      const c = bare(e);
      const root = ts.isPropertyAccessExpression(c) ? c.expression : c;
      if (!ts.isIdentifier(root) || (root.text !== "records" && root.text !== "refusals")) return false;
      const at = checker.getSymbolAtLocation(root);
      const decls = at === undefined ? [] : (resolved(at).declarations ?? []);
      return decls.some((d) => RECORD_FILE.test(d.getSourceFile().fileName));
    };
    const classMismatch = (c: ts.Expression, t: ts.Type): boolean => {
      const k = classOf(bare(c), "");
      const ks = k?.getSymbol();
      return ks !== undefined && members(t).some((m) => m.getSymbol() === ks);
    };

    /** Whether the predicate `q` (given to `every`) proves `elem` of each element. */
    const elementProof = (q: ts.Expression, elem: ts.Type): boolean => {
      const b = bare(q);
      if (ts.isArrowFunction(b) || ts.isFunctionExpression(b)) {
        const [first] = b.parameters;
        const sym = first === undefined ? undefined : checker.getSymbolAtLocation(first.name);
        const body = proofOf(b, false);
        if (sym === undefined || body === undefined) return false;
        return prover({ kind: "param", sym }, ownParams, file).chain(ands(body), "", elem, false) === undefined;
      }
      for (const sig of checker.getSignaturesOfType(checker.getTypeAtLocation(b), ts.SignatureKind.Call)) {
        const tp = checker.getTypePredicateOfSignature(sig);
        if (tp?.kind === ts.TypePredicateKind.Identifier && tp.parameterIndex === 0 && assignable(tp.type, elem))
          return accepted(sig.getDeclaration());
      }
      return false;
    };

    /** Whether `c` is an accepted predicate's call proving `<s>` an object (no primitive, no `null`). */
    const provesObject = (c: ts.Expression, s: string): boolean => {
      const e = bare(c);
      if (!ts.isCallExpression(e)) return false;
      const rs = checker.getResolvedSignature(e);
      const tp = rs === undefined ? undefined : checker.getTypePredicateOfSignature(rs);
      if (tp?.kind !== ts.TypePredicateKind.Identifier || !on(e.arguments[tp.parameterIndex], s)) return false;
      const objects = members(tp.type).every(
        (m) => (m.flags & (ts.TypeFlags.Object | ts.TypeFlags.NonPrimitive)) !== 0,
      );
      return objects && rs !== undefined && accepted(rs.getDeclaration());
    };

    /** Whether the one conjunct `c` proves `<s>` is `t` (k.identity proofs 1 to 4, and the atoms of 5). */
    const atom = (c: ts.Expression, s: string, t: ts.Type, opt: boolean, rest: readonly ts.Expression[]): boolean => {
      const e = bare(c);
      const sig = holdsSignature(t);
      const par = holdsParam(t);
      if (opOf(e, ts.SyntaxKind.BarBarToken) !== undefined)
        return ors(e).every(
          (d) =>
            (opt && isUndefinedCheck(d, s)) ||
            chain([...ands(d), ...rest.filter((r) => r !== c)], s, t, opt) === undefined,
        );
      const kind = typeofOf(e, s);
      if (kind !== undefined) {
        if (kind === "function") return members(t).some(plainCallable);
        const prim = primitiveOf(kind);
        return prim !== undefined && !par && assignable(prim, t);
      }
      const lit = literalOf(e, s);
      if (lit !== undefined) return !par && assignable(checker.getTypeAtLocation(lit), t);
      if (ts.isCallExpression(e)) {
        const rs = checker.getResolvedSignature(e);
        const tp = rs === undefined ? undefined : checker.getTypePredicateOfSignature(rs);
        if (
          tp?.kind === ts.TypePredicateKind.Identifier &&
          on(e.arguments[tp.parameterIndex], s) &&
          assignable(tp.type, t) &&
          rs !== undefined
        )
          return accepted(rs.getDeclaration());
        const callee = bare(e.expression);
        const [arg] = e.arguments;
        if (
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "has" &&
          on(arg, s) &&
          isRecord(callee.expression)
        )
          return true;
        if (ts.isPropertyAccessExpression(callee) && callee.name.text === "has" && on(arg, s) && !par) {
          const adds = ownSet(callee.expression, file);
          return adds?.every((v) => assignable(checker.getTypeAtLocation(v), t)) === true;
        }
        return false;
      }
      if (ts.isPropertyAccessExpression(e) && e.name.text === "ok" && !sig) {
        const call = bare(e.expression);
        if (!ts.isCallExpression(call) || call.arguments.length !== 1 || !on(call.arguments[0], s)) return false;
        const callee = bare(call.expression);
        if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "parse") return false;
        const parse = checker.getSymbolAtLocation(callee.name);
        if (!(parse?.declarations ?? []).some((d) => SCHEMA_FILE.test(d.getSourceFile().fileName))) return false;
        const result = checker.getTypeAtLocation(call);
        return members(result).some((m) => {
          const value = m.getProperty("value");
          return value !== undefined && assignable(checker.getTypeOfSymbol(value), t);
        });
      }
      if (opOf(e, ts.SyntaxKind.InstanceOfKeyword) !== undefined) {
        const k = classOf(e, s);
        return k !== undefined && !par && assignable(k, t);
      }
      return false;
    };

    /** Whether the `&&` chain `conjs` proves `<s>` is `t`; else the gap, naming the first unproven property. */
    const chain = (conjs: readonly ts.Expression[], s: string, t: ts.Type, opt: boolean): Gap | undefined => {
      if ((t.flags & OPEN) !== 0) return undefined;
      if (conjs.some((c) => atom(c, s, t, opt, conjs))) return undefined;
      if (t.isUnion()) {
        if (t.types.some((m) => chain(conjs, s, m, opt) === undefined)) return undefined;
        return { prop: undefined };
      }
      if (t.isIntersection()) {
        for (const m of t.types) {
          const g = chain(conjs, s, m, opt);
          if (g !== undefined) return g;
        }
        return undefined;
      }
      const object =
        (conjs.some((c) => typeofOf(bare(c), s) === "object") && conjs.some((c) => isNotNull(bare(c), s))) ||
        conjs.some((c) => provesObject(c, s));
      if ((t.flags & ts.TypeFlags.NonPrimitive) !== 0) return object ? undefined : { prop: undefined };
      if (holdsSignature(t) || holdsParam(t) || (t.flags & ts.TypeFlags.Object) === 0) return { prop: undefined };
      if (checker.isTupleType(t)) return { prop: undefined };
      if (checker.isArrayType(t)) {
        const elem = checker.getIndexInfosOfType(t)[0]?.type;
        const isArray = conjs.some((c) => {
          const b = bare(c);
          return ts.isCallExpression(b) && isMember(b.expression, "Array", "isArray") && on(b.arguments[0], s);
        });
        if (!isArray || elem === undefined) return { prop: undefined };
        if ((elem.flags & OPEN) !== 0) return undefined;
        const every = conjs.some((c) => {
          const b = bare(c);
          if (!ts.isCallExpression(b) || !ts.isPropertyAccessExpression(b.expression)) return false;
          const [q] = b.arguments;
          return (
            b.expression.name.text === "every" &&
            on(b.expression.expression, s) &&
            q !== undefined &&
            elementProof(q, elem)
          );
        });
        return every ? undefined : { prop: undefined };
      }
      if (!object) return { prop: undefined };
      for (const p of checker.getPropertiesOfType(t)) {
        const sub = `${s}.${p.name}`;
        const label = sub.slice(1);
        const pt = checker.getTypeOfSymbol(p);
        const optional = (p.flags & ts.SymbolFlags.Optional) !== 0;
        if ((pt.flags & OPEN) !== 0) {
          if (!optional && !conjs.some((c) => isKeyed(bare(c), sub))) return { prop: label };
          continue;
        }
        const g = chain(conjs, sub, pt, optional);
        if (g !== undefined) return { prop: g.prop ?? label };
      }
      if (checker.getIndexInfosOfType(t).some((info) => (info.type.flags & OPEN) === 0)) return { prop: undefined };
      return undefined;
    };

    return { subjectOf, chain, classMismatch, holdsParam };
  };

  const out: { at: number; message: string }[] = [];
  const visit = (n: ts.Node): void => {
    const found = predicateOf(n);
    if (found !== undefined) {
      const what = judge(found.fn, found.pred, sf);
      if (what !== undefined)
        out.push({
          at: found.pred.getStart(sf),
          message: `type predicate claims ${what} it does not prove: check it, or use unsafe()`,
        });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
