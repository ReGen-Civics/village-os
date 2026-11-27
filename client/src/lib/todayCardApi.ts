/**
 * Today's card, client side: the three doors in server/routes/myCard.ts, through `gameFetch` so each carries
 * the member's token. Shapes: shared/myCard.ts.
 *
 * A pull sends the member's own date and the sky at NOON UTC of that date, read in this browser
 * (shared/geneKeysSky.ts `skyAt`): the server cannot hold the ephemeris, and one instant per date makes the sky
 * the same on every device and in every time zone, so the draw is too. The ephemeris loads only on a pull.
 */
import { MY_CARD_API, MY_CARD_CONSENT_API, noonUtc, type CardConsent, type MyCardAnswer, type TodayFacts } from "@shared/myCard";
import { gameFetch } from "./gameApi";

/** A refusal in the server's own sentence. */
export class TodayCardRefusal extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await gameFetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const sentence = typeof body?.error === "string" && /\s/.test(body.error) ? body.error : "";
    throw new TodayCardRefusal(sentence, res.status);
  }
  return body as T;
}

/** This device's date, `YYYY-MM-DD`, in its own time zone. */
export function localDate(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function readTodayCard(date: string): Promise<MyCardAnswer> {
  return call<MyCardAnswer>(`${MY_CARD_API}?date=${encodeURIComponent(date)}`);
}

export async function pullTodayCard(date: string, today: TodayFacts | null): Promise<MyCardAnswer> {
  const { skyAt } = await import("@shared/geneKeysSky");
  const sky = skyAt(noonUtc(date));
  return call<MyCardAnswer>(MY_CARD_API, { method: "POST", body: JSON.stringify({ date, sky, ...(today ? { today } : {}) }) });
}

/** The one tap: yes to the line the member was shown. */
export function consentToCard(line: Extract<CardConsent, { state: "ask" }>): Promise<{ consent: CardConsent }> {
  return call(MY_CARD_CONSENT_API, { method: "POST", body: JSON.stringify({ provider: line.provider, operator: line.operator, source: line.source }) });
}
