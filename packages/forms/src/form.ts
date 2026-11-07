import { batch, effect, owner, signal } from "@keel/reactive";
import { formHandle } from "@keel/router/internal";
import type { Infer, ObjectSchema, Result, SchemaError } from "@keel/schema";
import { asSchemaValue } from "../unsafe/asSchemaValue.ts";
import type { Bindable } from "./internal/Bindable.ts";
import type { Reading } from "./internal/Reading.ts";
import { claimFormId } from "./internal/claimFormId.ts";
import { describedBy } from "./internal/describedBy.ts";
import { documentOrder } from "./internal/documentOrder.ts";
import { fieldMessages } from "./internal/fieldMessages.ts";
import { fieldPathError } from "./internal/fieldPathError.ts";
import { formatValue } from "./internal/formatValue.ts";
import { getAt } from "./internal/getAt.ts";
import { issueMessages } from "./internal/issueMessages.ts";
import { nodeAt } from "./internal/nodeAt.ts";
import { readElement } from "./internal/readElement.ts";
import { setAt } from "./internal/setAt.ts";
import { shapeHash } from "./internal/shapeHash.ts";
import { splitPath } from "./internal/splitPath.ts";
import { unwrap } from "./internal/unwrap.ts";
import { withDefaults } from "./internal/withDefaults.ts";
import { withUnmapped } from "./internal/withUnmapped.ts";
import { without } from "./internal/without.ts";
import type { DeepPartial } from "./types/DeepPartial.ts";
import type { Field } from "./types/Field.ts";
import type { FieldPath } from "./types/FieldPath.ts";
import type { FormState } from "./types/FormState.ts";
import type { PathValue } from "./types/PathValue.ts";

type Messages = Readonly<Record<string, string>>;

/**
 * Create form state in the calling scope (k.forms). Field ids are `<formId>:<path>`; formId is `options.id` or a hash of the schema shape, never a process counter. Signals belong to the current scope (none: E1203);
 * bound elements unbind when the scope that called `bind` is disposed.
 */
export function form<S extends ObjectSchema<object>, T extends object = Infer<S>>(
  schema: ObjectSchema<T> & S,
  options: { readonly initial?: DeepPartial<NoInfer<T>>; readonly id?: string } = {},
): FormState<T> {
  const typed: ObjectSchema<T> = schema;
  const root = typed.node;
  const initial = withDefaults(root, options.initial ?? {});
  const formId = claimFormId(options.id ?? `form-${shapeHash(root)}`);

  const vals = signal<unknown>(initial);
  const raw = signal<Messages>({});
  const errs = signal<Messages>({});
  const touchedPaths = signal<ReadonlySet<string>>(new Set());
  const pendingSignal = signal(false);
  const shown = new Set<string>();
  const known = new Set<string>();
  const bound = new Map<string, Set<Bindable>>();

  const candidate = (): unknown => {
    let c = vals.get();
    for (const [p, text] of Object.entries(raw.get())) c = setAt(root, c, splitPath(p), text);
    return withDefaults(root, c);
  };
  const setErrors = (next: Messages): void => {
    for (const p of Object.keys(next)) shown.add(p);
    errs.set(next);
  };
  const validateField = (path: string): void => {
    const parsed = typed.parse(candidate());
    const message = parsed.ok ? undefined : issueMessages(root, parsed.error.data.issues, [path])[path];
    const current = errs.get();
    if (message !== undefined) {
      shown.add(path);
      if (current[path] !== message) errs.set({ ...current, [path]: message });
    } else if (Object.hasOwn(current, path)) errs.set(without(current, path));
  };
  const validateAll = (): Result<T, SchemaError> => {
    const parsed = typed.parse(candidate());
    setErrors(parsed.ok ? {} : withUnmapped(issueMessages(root, parsed.error.data.issues, known), known));
    return parsed;
  };
  const focusFirstInvalid = (): void => {
    const current = errs.get();
    const els = [...bound]
      .filter(([p]) => Object.hasOwn(current, p))
      .flatMap(([, set]) => [...set])
      .filter((el) => el.isConnected);
    els.sort(documentOrder)[0]?.focus();
  };
  const reset = (): void =>
    batch(() => {
      vals.set(initial);
      raw.set({});
      errs.set({});
      touchedPaths.set(new Set());
      shown.clear();
    });

  const makeField = <V>(path: string): Field<V> => {
    const segs = splitPath(path);
    const node = segs.length === 0 ? undefined : nodeAt(root, segs);
    if (node === undefined) throw fieldPathError(path);
    known.add(path);
    let id = `${formId}:${path}`;
    let errorId = `${id}:error`;
    const write = (r: Reading): void =>
      batch(() => {
        const current = raw.get();
        if (r.kind === "raw") {
          vals.set(setAt(root, vals.get(), segs, undefined));
          if (current[path] !== r.text) raw.set({ ...current, [path]: r.text });
        } else {
          if (Object.hasOwn(current, path)) raw.set(without(current, path));
          vals.set(setAt(root, vals.get(), segs, r.kind === "value" ? r.value : undefined));
        }
        if (shown.has(path)) validateField(path);
      });
    const blur = (): void =>
      batch(() => {
        const t = touchedPaths.get();
        if (!t.has(path)) touchedPaths.set(new Set([...t, path]));
        validateField(path);
      });
    const sync = (el: Bindable): void => {
      const text = raw.get()[path];
      const v = getAt(vals.get(), segs);
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        const boolean = el.type === "checkbox" && unwrap(node).kind === "boolean";
        el.checked = boolean ? v === true : v !== undefined && formatValue(v) === el.value;
        return;
      }
      if (text !== undefined) {
        if (el.value !== text) el.value = text;
        return;
      }
      const shownNow = readElement(el, node);
      if (shownNow?.kind === "value" && Object.is(shownNow.value, v)) return;
      if (shownNow?.kind === "absent" && v === undefined) return;
      el.value = formatValue(v);
    };
    const aria = (el: Bindable): void => {
      const invalid = errs.get()[path] !== undefined;
      if (invalid) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
      describedBy(el, errorId, invalid);
    };
    return {
      name: path,
      get id() {
        return id;
      },
      get errorId() {
        return errorId;
      },
      value: () => asSchemaValue<V | undefined>(getAt(vals.get(), segs)),
      error: () => errs.get()[path],
      touched: () => touchedPaths.get().has(path),
      set: (v) => write(v === undefined ? { kind: "absent" } : { kind: "value", value: v }),
      blur,
      bind: (el) => {
        el.name = path;
        if (!(el instanceof HTMLInputElement && el.type === "radio")) {
          // An id already on the element wins over the counter-derived one (D19); errorId follows it.
          if (el.id === "") el.id = id;
          else {
            id = el.id;
            errorId = `${id}:error`;
          }
        }
        const els = bound.get(path) ?? new Set<Bindable>();
        els.add(el);
        bound.set(path, els);
        const onInput = (): void => {
          const r = readElement(el, node);
          if (r !== undefined) write(r);
        };
        el.addEventListener("input", onInput);
        el.addEventListener("blur", blur);
        const effects = [effect(() => sync(el)), effect(() => aria(el))];
        let done = false;
        const unbind = (): void => {
          if (done) return;
          done = true;
          el.removeEventListener("input", onInput);
          el.removeEventListener("blur", blur);
          for (const e of effects) e.dispose();
          els.delete(el);
          if (els.size === 0 && bound.get(path) === els) bound.delete(path);
        };
        owner()?.onDispose(unbind);
        return unbind;
      },
    };
  };

  return {
    field: <P extends FieldPath<T> | (string & {})>(
      path: string extends P ? P : P & FieldPath<T>,
    ): Field<string extends P ? unknown : PathValue<T, P & string>> =>
      makeField<string extends P ? unknown : PathValue<T, P & string>>(path),
    values: () => asSchemaValue<DeepPartial<T>>(vals.get()),
    errors: () => errs.get(),
    pending: () => pendingSignal.get(),
    reset,
    // The `<Form form>` seam, keyed by a symbol so it is not public API (RFC 0045).
    [formHandle]: {
      setPending: (v) => pendingSignal.set(v),
      validate: () =>
        batch(() => {
          const r = validateAll();
          if (!r.ok) focusFirstInvalid();
          return r;
        }),
      onResult: (result) => {
        if (result.ok) reset();
        else if (result.error.code === "keel.fields") setErrors(fieldMessages(result.error.data));
      },
    },
  };
}
