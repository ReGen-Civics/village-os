/**
 * One document in the investor pack, for an e2e suite whose subject is what a
 * pack request does next (its email, its lead, its journey). Since 24 Nov 2026
 * a request while the pack is empty is refused (server/index.ts,
 * /api/investor-docs/request): the lead asked for the button to be disabled
 * then, and the server is the backstop. So a suite that asks for the pack puts
 * a document in it first, through the same admin doors a founder uses.
 */
export async function putADocumentInThePack(base: string, token: string, title = "Pack fixture"): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(Buffer.from(`${title}\nfixture body\n`, "utf8"))], { type: "text/plain" }), `${title}.txt`);
  form.append("name", title);
  const up = await fetch(`${base}/api/admin/investor-docs/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }); // module-review-ok: the test client dialling the built server on localhost
  const doc = (await up.json().catch(() => null)) as { id?: string } | null;
  if (!up.ok || !doc?.id) throw new Error(`the pack fixture did not upload: HTTP ${up.status}`);
  const set = await fetch(`${base}/api/admin/investor-docs/${encodeURIComponent(doc.id)}`, { // module-review-ok: the test client dialling the built server on localhost
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inPacket: true }),
  });
  if (!set.ok) throw new Error(`the pack fixture could not be put in the pack: HTTP ${set.status}`);
  return String(doc.id);
}
