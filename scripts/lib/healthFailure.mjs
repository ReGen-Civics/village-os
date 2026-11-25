/**
 * Why a /health ask got no answer, down to the socket: undici says only "fetch failed" and keeps the reason in
 * `cause` (ECONNREFUSED 127.0.0.1:6566, ECONNRESET, or each family's attempt under happy eyeballs), which is what
 * tells a server that is not up from a port held by somebody else.
 */
export function healthFailure(e) {
  const head = `${String(e?.name ?? "")}: ${String(e?.message ?? e).slice(0, 200)}`;
  const c = e?.cause;
  if (!c) return head;
  const one = (x) => [x?.code, x?.address && `${x.address}${x.port ? `:${x.port}` : ""}`, !x?.code && x?.message].filter(Boolean).join(" ");
  const each = Array.isArray(c.errors) && c.errors.length ? ` [${c.errors.map(one).join("; ")}]` : "";
  return `${head}; cause ${one(c) || String(c).slice(0, 200)}${each}`;
}
