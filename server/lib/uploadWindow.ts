/**
 * A LONGER WINDOW FOR ONE UPLOAD, AND ONLY FOR IT (the ops request of 19 Nov 2026: an 8-minute take must survive a
 * slow mobile connection).
 *
 * Node gives every request `server.requestTimeout` (300,000 ms by default, and server/index.ts keeps it) to arrive
 * whole. A 15-minute take and three CVs on a 1 Mbit/s line take longer than that, and Node would answer 408 and
 * close the socket while the applicant's bytes were still coming. The rest of the server keeps the five minutes:
 * it is what stops a slow-drip client holding a connection open.
 *
 * HOW THE WINDOW IS LIFTED FOR ONE REQUEST. Node has no per-request requestTimeout. Its periodic check
 * (`checkConnections` in node:_http_server, every `connectionsCheckingInterval`) reports an expired request
 * through `socketOnError`, which first emits `clientError` on the server and does its own 408 and destroy only when
 * nobody listens. So `liftRequestTimeout` marks this request's socket with its own deadline and installs ONE
 * `clientError` listener on the server (once, idempotent):
 *
 *   - ERR_HTTP_REQUEST_TIMEOUT on a marked socket inside its deadline: ignored, the upload carries on. Node
 *     reports an expired request once and then drops it from its list (ConnectionsList::Expired), so the
 *     request's own deadline is held by a timer here: past it, with the body still arriving, the request is
 *     answered 408 and closed exactly as Node would have.
 *   - Anything else (an unmarked socket, a marked one past its deadline, a parse error, a header overflow):
 *     answered exactly as Node itself answers it (the 408, 431 or 400 it would write, then destroy).
 *
 * The mark comes off when the response finishes or the connection closes, so a kept-alive socket's next request
 * meets the ordinary five minutes. A lifted request also gets an idle timeout (UPLOAD_IDLE_MS): no byte for two
 * minutes and it is dropped, so a longer window never means a connection held open by nothing.
 *
 * Verified against Node 22's own source (lib/_http_server.js `checkConnections`, `onRequestTimeout`,
 * `socketOnError`); uploadWindow.test.ts holds a slow upload past a small requestTimeout on a real server.
 */
import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { Request } from "express";
import { UPLOAD_IDLE_MS } from "../../shared/applyLimits";

const DEADLINE = Symbol.for("village.uploadDeadline");
const HOOKED = Symbol.for("village.uploadWindowHooked");

type Marked = Socket & { [DEADLINE]?: number; _httpMessage?: { headersSent?: boolean; _headerSent?: boolean } | null };

/** The responses Node itself writes on a client error (lib/_http_server.js), so the listener changes nothing else. */
const RESPONSES: Record<string, string> = {
  ERR_HTTP_REQUEST_TIMEOUT: "HTTP/1.1 408 Request Timeout\r\nConnection: close\r\n\r\n",
  HPE_HEADER_OVERFLOW: "HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\n\r\n",
  HPE_CHUNK_EXTENSIONS_OVERFLOW: "HTTP/1.1 413 Payload Too Large\r\nConnection: close\r\n\r\n",
};
const BAD_REQUEST = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";

/** Whether this socket is inside a lifted window now. */
export function insideUploadWindow(socket: Socket, now = Date.now()): boolean {
  const d = (socket as Marked)[DEADLINE];
  return typeof d === "number" && now < d;
}

/** The one listener, installed once per server. */
function hook(server: Server): void {
  const s = server as Server & { [HOOKED]?: boolean };
  if (s[HOOKED]) return;
  s[HOOKED] = true;
  server.on("clientError", (err: NodeJS.ErrnoException, socket: Socket) => {
    if (err?.code === "ERR_HTTP_REQUEST_TIMEOUT" && insideUploadWindow(socket)) return;
    // As Node answers it with no listener: a reply only if nothing of a response went out yet, then close.
    const m = (socket as Marked)._httpMessage;
    if (socket.writable && (!m || !(m._headerSent || m.headersSent))) {
      try {
        socket.write(RESPONSES[String(err?.code)] ?? BAD_REQUEST);
      } catch {
        /* already closing */
      }
    }
    socket.destroy(err);
  });
}

/**
 * Give this request `ms` from now to arrive whole, past Node's requestTimeout, and drop it after UPLOAD_IDLE_MS
 * with no byte. Call it before the body is read. Returns false when the request has no server to hook (a test's
 * fake request), and then nothing changed.
 */
export function liftRequestTimeout(req: Request, ms: number, idleMs: number = UPLOAD_IDLE_MS): boolean {
  const socket = req.socket as Marked | undefined;
  const server = (socket as (Marked & { server?: Server }) | undefined)?.server;
  if (!socket || !server || typeof server.on !== "function") return false;
  hook(server);
  socket[DEADLINE] = Date.now() + Math.max(0, ms);
  // Node reports an expired request once only, so the lifted deadline is this timer's to keep.
  const timer = setTimeout(() => {
    if (req.complete) return;
    const m = socket._httpMessage;
    if (socket.writable && (!m || !(m._headerSent || m.headersSent))) {
      try {
        socket.write(RESPONSES.ERR_HTTP_REQUEST_TIMEOUT);
      } catch {
        /* already closing */
      }
    }
    socket.destroy();
  }, Math.max(0, ms));
  timer.unref?.();
  const clear = () => {
    clearTimeout(timer);
    socket[DEADLINE] = undefined;
  };
  req.once("end", () => clearTimeout(timer));
  req.res?.once("finish", clear);
  req.res?.once("close", clear);
  // No byte for a while: give up on it, however long its window. Node's own server.timeout is 0 here.
  req.setTimeout(idleMs, () => {
    clear();
    req.destroy(new Error("upload idle"));
  });
  return true;
}
