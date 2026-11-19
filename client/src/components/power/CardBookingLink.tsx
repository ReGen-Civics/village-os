/**
 * HOW ONE CONVERSATION IS BOOKED, on the card's "How it is filled" (the lead, Anchor session of 19 Nov 2026):
 * a link to the interviewing role's booking page or WhatsApp, or a note with no number (shared/cardBooking.ts).
 * Loaded lazily by RoleCardParams, so it rides no route's first view.
 */
import { useLingui } from "@lingui/react/macro";
import type { CardBooking } from "@shared/cardBooking";

export default function CardBookingLink({ b }: { b: CardBooking }) {
  const { t } = useLingui();
  if (b.kind === "note") return <span className="block text-muted-foreground" data-card-booking="note">{t({ message: "We'll message you on WhatsApp", context: "role card: a conversation held on WhatsApp, no number shown" })}</span>;
  const label = b.kind === "whatsapp" ? t({ message: "Message on WhatsApp", context: "role card: book a conversation on WhatsApp" }) : t({ message: "Book a time", context: "role card: book a conversation" });
  return (
    <a href={b.url} target="_blank" rel="noopener noreferrer" className="block font-medium text-notice underline underline-offset-2 hover:text-foreground" data-card-booking={b.kind}>
      {label}
    </a>
  );
}
