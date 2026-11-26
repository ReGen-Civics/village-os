/**
 * The type a shared word table has once it is drawn in the reader's language: each literal string widened to
 * `string`, functions keeping their arguments. A builder in `shared/` that bakes words into a view model takes
 * this type, so the client can hand it a translated copy and the server keeps the English original
 * (client/src/i18n/wordTable.ts, lane ES-A, 26 Nov 2026).
 */
export type Widened<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widened<R>
    : T extends readonly unknown[]
      ? T
      : T extends object
        ? { [K in keyof T]: Widened<T[K]> }
        : T;
