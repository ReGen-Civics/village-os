// healthFailure (scripts/lib/healthFailure.mjs): the boot poll's last answer names the socket's reason, which
// undici keeps in `cause` behind "fetch failed". Run: node scripts/healthFailure.test.mjs
import http from "node:http";
import net from "node:net";
import { healthFailure } from "./lib/healthFailure.mjs";

let failed = 0;
const expect = (what, ok, got) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : `: ${got}`}`);
};

// A port nobody holds: refused, and the line says so with the address.
const free = await new Promise((r) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const refused = await fetch(`http://127.0.0.1:${free}/health`).then(() => "answered", healthFailure);
expect("a closed port reads ECONNREFUSED and its address", /fetch failed; cause ECONNREFUSED 127\.0\.0\.1:\d+/.test(refused), refused);

// A port held by something that accepts and hangs up: a reset, told apart from a refusal.
const rude = net.createServer((sock) => sock.destroy()).listen(0, "127.0.0.1");
await new Promise((r) => rude.once("listening", r));
const reset = await fetch(`http://127.0.0.1:${rude.address().port}/health`).then(() => "answered", healthFailure);
rude.close();
expect("a stranger that hangs up reads as such, not as refused", /fetch failed; cause/.test(reset) && !/ECONNREFUSED/.test(reset), reset);

// A bounded ask that ran out: no cause to show, the name says it.
const slow = http.createServer(() => {}).listen(0, "127.0.0.1");
await new Promise((r) => slow.once("listening", r));
const timedOut = await fetch(`http://127.0.0.1:${slow.address().port}/health`, { signal: AbortSignal.timeout(200) }).then(() => "answered", healthFailure);
slow.closeAllConnections?.();
slow.close();
expect("a timeout reads as one", /^TimeoutError/.test(timedOut), timedOut);

console.log(failed ? `healthFailure: ${failed} failed` : "healthFailure: 3 checks passed");
process.exit(failed ? 1 : 0);
