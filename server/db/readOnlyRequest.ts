/**
 * A REQUEST THAT MAY NOT WRITE, WHATEVER ITS METHOD SAYS (the admin live view, 25 Nov 2026; server/lib/liveView.ts).
 *
 * "GET only" is a rule about the method, and a method is a promise a handler can break: a scan of the GET handlers
 * found about thirty whose bodies write (an audit row, a queue claim, a counter), thirteen under /api/admin. A request
 * run inside `runReadOnly` can make no write at all: the pool (server/db/pool.ts) refuses every statement that is not
 * a read while the flag is set, so a handler that tries one throws and the route answers an error. That error is
 * itself a QA finding: a page that writes when somebody only looks at it.
 *
 * `outsideReadOnly` steps out on purpose, for the one write the live view makes about itself (its audit line).
 */
import { AsyncLocalStorage } from "node:async_hooks";

const flag = new AsyncLocalStorage<{ why: string }>();

export class ReadOnlyRequestError extends Error {
  constructor(why: string) {
    super(`This request only reads (${why}); a write was refused.`);
    this.name = "ReadOnlyRequestError";
  }
}

/** Run `fn`, and everything it starts, with writes refused. */
export function runReadOnly<T>(why: string, fn: () => T): T {
  return flag.run({ why }, fn);
}

/** Run `fn` outside any read-only flag: the live view's own audit line, and nothing else. */
export function outsideReadOnly<T>(fn: () => T): T {
  return flag.exit(fn);
}

/** Why the current request may not write, or null when it may. */
export function readOnlyReason(): string | null {
  return flag.getStore()?.why ?? null;
}

/**
 * The statements that only read, and the transaction words a consistent read may wrap itself in. Anything else is a
 * write: an unknown statement is refused, never guessed at.
 */
const READS = /^(select|show|describe|desc|explain|with|start\s+transaction|begin|commit|rollback)\b/;

/** Whether this SQL writes, judged by its first keyword after any comments. */
export function isWriteSql(sql: unknown): boolean {
  const text = typeof sql === "string" ? sql : sql && typeof sql === "object" && "sql" in sql ? String((sql as { sql: unknown }).sql) : "";
  const bare = text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*(--|#)[^\n]*$/gm, " ")
    .trim()
    .replace(/^\(+\s*/, "")
    .toLowerCase();
  if (!READS.test(bare)) return true;
  // SELECT ... FOR UPDATE / LOCK IN SHARE MODE take locks a look should never take.
  return /\bfor\s+update\b|\block\s+in\s+share\s+mode\b|\binto\s+(outfile|dumpfile)\b/.test(bare);
}

type Queryable = { query: (...a: any[]) => any; execute?: (...a: any[]) => any };

function guardMethods<T extends Queryable>(target: T): T {
  for (const name of ["query", "execute"] as const) {
    const original = (target as any)[name];
    if (typeof original !== "function" || (original as any).__readOnlyGuard) continue;
    const guarded = function (this: unknown, sql: unknown, ...rest: unknown[]) {
      const why = readOnlyReason();
      if (why && isWriteSql(sql)) return Promise.reject(new ReadOnlyRequestError(why));
      return original.call(this ?? target, sql, ...rest);
    };
    (guarded as any).__readOnlyGuard = true;
    (target as any)[name] = guarded;
  }
  return target;
}

/**
 * Teach a promise pool to refuse writes inside `runReadOnly`: its own query and execute, and those of every
 * connection it hands out. Outside the flag nothing changes, so every other request is exactly as before.
 */
export function guardPool<P extends Queryable & { getConnection?: (...a: any[]) => Promise<any> }>(pool: P): P {
  guardMethods(pool);
  const getConnection = pool.getConnection;
  if (typeof getConnection === "function" && !(getConnection as any).__readOnlyGuard) {
    const guarded = async function (this: unknown, ...a: unknown[]) {
      return guardMethods(await getConnection.apply(pool, a));
    };
    (guarded as any).__readOnlyGuard = true;
    (pool as any).getConnection = guarded;
  }
  return pool;
}
