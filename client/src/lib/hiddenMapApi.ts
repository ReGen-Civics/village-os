/**
 * The hidden map's HTTP surface, client side. The doors are listed at the head
 * of server/routes/hiddenMap.ts; this file only calls them.
 *
 * Every call carries the member's token: no hidden-map door answers a
 * stranger. JSON goes through `gameFetch`; photos go as multipart with the
 * same Authorization header and no Content-Type, so the browser writes the
 * boundary. A photo is read back as a blob for the same reason: an `<img src>`
 * cannot carry a token, and these photos are never public.
 */
import type { Layer, PartnerState, PinDot, PinView, Precision, Stage, VouchWay } from "@shared/hiddenMap";
import { authToken, gameFetch } from "./gameApi";

export interface MapMe {
  open: boolean;
  vouchedCount: number;
  needed: number;
  ownPins: number;
  /** How many pins the whole map holds: the one thing a closed map learns about everybody else's. */
  allPins: number;
  /** How many members have logged a pin. */
  planters: number;
  vouchesPerPin: number;
  openedAt: string | null;
  openedBefore: number;
  kindPrompts: Record<Layer, string>;
  /** Whether the village pays for a planting once it is vouched. */
  plantingPays: boolean;
  vouchWays: VouchWay[];
  vouchRule: string;
  /** Filled by the page from the member's own pins. */
  ownPlantings?: number;
  keeper: boolean;
  mayApproveExports: boolean;
  title: string;
  labels: Record<Layer, string>;
  kinds: Record<Layer, string[]>;
  openLayers: Layer[];
  basemap: string;
  maxZoom: number;
  defaultPrecision: Precision;
  teaser: boolean;
  precisions: Precision[];
}

export interface PinDraft {
  clientId: string;
  layer: Layer;
  kind: string;
  lat: number;
  lng: number;
  precision: Precision;
  title?: string;
  whatWentIn?: string;
  notes?: string;
  partnerState?: PartnerState | null;
  plantedOn?: string | null;
  native?: boolean;
}

export interface VisitView {
  id: string;
  mine: boolean;
  stageSeen: Stage | null;
  note: string | null;
  createdAt: string;
  photoIds: string[];
}

export interface ExportView {
  id: string;
  mine: boolean;
  precision: Precision;
  status: string;
  decidedByMe: boolean;
  expiresAt: string;
  createdAt: string;
}

export class Refused extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const authHeaders = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof (body as any)?.error === "string" && (body as any).error.includes(" ") ? (body as any).error : "That did not go through. Try again.";
    throw new Refused(res.status, msg);
  }
  return body as T;
}

export const getMe = async () => json<MapMe>(await gameFetch("/api/hidden-map/me"));

export const getPins = async () => json<{ pins: Array<PinView | PinDot>; open: boolean }>(await gameFetch("/api/hidden-map/pins"));

export const getPin = async (id: string) =>
  json<{ pin: PinView; visits: VisitView[]; mayVisit: boolean }>(await gameFetch(`/api/hidden-map/pins/${encodeURIComponent(id)}`));

export const createPin = async (draft: PinDraft) =>
  json<{ pin: PinView }>(await gameFetch("/api/hidden-map/pins", { method: "POST", body: JSON.stringify(draft) }));

export async function addPhotos(pinId: string, photos: Blob[]): Promise<{ photoIds: string[] }> {
  const body = new FormData();
  photos.forEach((p, i) => body.append("photos", p, `photo-${i}.${p.type === "image/jpeg" ? "jpg" : "webp"}`));
  const res = await fetch(`/api/hidden-map/pins/${encodeURIComponent(pinId)}/photos`, { method: "POST", headers: authHeaders(), body });
  return json(res);
}

export async function addVisit(
  pinId: string,
  visit: { clientId: string; stageSeen: Stage | null; note: string },
  photos: Blob[],
): Promise<{ visitId: string; claimed?: boolean }> {
  const body = new FormData();
  body.append("clientId", visit.clientId);
  if (visit.stageSeen) body.append("stageSeen", visit.stageSeen);
  if (visit.note) body.append("note", visit.note);
  photos.forEach((p, i) => body.append("photos", p, `visit-${i}.${p.type === "image/jpeg" ? "jpg" : "webp"}`));
  const res = await fetch(`/api/hidden-map/pins/${encodeURIComponent(pinId)}/visits`, { method: "POST", headers: authHeaders(), body });
  return json(res);
}

export const vouch = async (id: string, seen: VouchWay) =>
  json<{ vouches: number }>(
    await gameFetch(`/api/hidden-map/pins/${encodeURIComponent(id)}/vouch`, { method: "POST", body: JSON.stringify({ seen }) }),
  );

export const unvouch = async (id: string) =>
  json<{ withdrawn: boolean }>(await gameFetch(`/api/hidden-map/pins/${encodeURIComponent(id)}/vouch`, { method: "DELETE" }));

export const hidePin = async (id: string) =>
  json<{ hidden: boolean }>(await gameFetch(`/api/hidden-map/pins/${encodeURIComponent(id)}/hide`, { method: "POST" }));

export const getQueue = async () => json<{ pins: PinView[]; mayVouch: boolean }>(await gameFetch("/api/hidden-map/vouch-queue"));

export const getExports = async () => json<{ exports: ExportView[] }>(await gameFetch("/api/hidden-map/exports"));

export const askExport = async (precision: Precision) =>
  json<{ id: string }>(await gameFetch("/api/hidden-map/exports", { method: "POST", body: JSON.stringify({ precision }) }));

export const answerExport = async (id: string, answer: "approve" | "decline" | "withdraw") =>
  json<{ status: string }>(await gameFetch(`/api/hidden-map/exports/${encodeURIComponent(id)}/${answer}`, { method: "POST" }));

/** Download an approved export once, as a file the browser saves. */
export async function downloadExport(id: string): Promise<void> {
  const res = await fetch(`/api/hidden-map/exports/${encodeURIComponent(id)}/download`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Refused(res.status, (body as any)?.error ?? "That export is not available.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `map-export-${id}.geojson`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A photo as an object URL the page revokes when it is done with it. */
export async function photoUrl(id: string, size: "thumb" | "full" = "thumb"): Promise<string> {
  const res = await fetch(`/api/hidden-map/photos/${encodeURIComponent(id)}${size === "thumb" ? "?size=thumb" : ""}`, { headers: authHeaders() });
  if (!res.ok) throw new Refused(res.status, "That photo is not available.");
  return URL.createObjectURL(await res.blob());
}

/** A device-made id for a pin or a visit, so a resend writes nothing twice. */
export function newClientId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
