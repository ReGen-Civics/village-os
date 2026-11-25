/**
 * A visitor's way back to their visitor profile (shared/visitorProfile.ts), drawn in the site header when
 * nobody is signed in and this browser holds a verified entrance. A visitor holds no member account, so
 * this sits where "Sign in" would be, and the mobile menu carries it above "Sign in or join".
 */
import { Link } from "wouter";
import { User } from "lucide-react";
import { Trans } from "@lingui/react/macro";

export { useVerifiedVisitor } from "@/lib/entranceStatus";

const HEADER = "flex items-center gap-2 px-3 py-1.5 bg-black/10 hover:bg-black/20 rounded-lg text-sm transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-deep";
const MENU = "block text-white hover:underline transition-colors text-sm py-2";

export default function VisitorLink({ place, onClick }: { place: "header" | "menu"; onClick?: () => void }) {
  return (
    <Link href="/visitor" className={place === "header" ? HEADER : MENU} onClick={onClick} data-visitor-link={place}>
      {place === "header" && <User className="w-4 h-4" />}
      <Trans context="site header: a visitor's link to their visitor profile">Your visit</Trans>
    </Link>
  );
}
