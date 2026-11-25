/**
 * PROFILE SETTINGS, its own page (profile overhaul, Direction D; the lead chose D on 25 Nov 2026).
 *
 * The profile is for who you are and what is next. The choices a member makes once and rarely changes
 * used to share its last tab with the bio: email addresses, notifications, the agent panel, the visitor
 * name switch, and time zone and booking link on the Treasury tab of all places. They live here now, in
 * six groups, each the panel it always was, moved and not rewritten.
 *
 * The layout is Direction D's: a sidebar of groups on a wide screen and a list you tap into on a phone
 * (from B), a search box above both that narrows the groups as you type (from C), and inset panels in the
 * house look. A group has its own address, /profile/settings#privacy, so a link can land on it.
 *
 * Settings are only ever the signed-in member's own: a signed-out reader is sent to sign in.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { ArrowLeft, ChevronRight, LogOut, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { BTN_SECONDARY, CARD, EYEBROW, H1, HINT, LINK, TILE, WORLD } from "@/components/journey/look";
import { Cell, Feather, Firefly, Held, Seed, SunLeaf } from "@/components/sacred/living";
import AccountEmailsPanel from "@/components/AccountEmailsPanel";
import TimeZoneField from "@/components/TimeZoneField";
import BookingLinkField from "@/components/BookingLinkField";
import AlignedSection from "@/components/profile/AlignedSection";
import PrivacyPanel from "@/components/profile/PrivacyPanel";
import NotifyPrefsPanel from "@/components/NotifyPrefsPanel";
import GuideChoiceCard from "@/components/guide/GuideChoiceCard";
import YourAgentPanel from "@/components/YourAgentPanel";
import { LanguagePicker } from "@/i18n/LanguagePicker";
import { useGameConfig } from "@/lib/gameApi";
import { MODE_CHANGED, applyMode, currentMode, type Mode } from "@/lib/colourMode";

export const SETTINGS_GROUPS = ["account", "privacy", "notifications", "look", "inner", "agents"] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

const isGroup = (v: string): v is SettingsGroup => (SETTINGS_GROUPS as readonly string[]).includes(v);

/** Light or dark, the same choice as the header's switch, which hears this one change. */
function ModeChoice() {
  const { t } = useLingui();
  const [mode, setMode] = useState<Mode>(() => currentMode());
  useEffect(() => {
    const heard = () => setMode(currentMode());
    window.addEventListener(MODE_CHANGED, heard);
    return () => window.removeEventListener(MODE_CHANGED, heard);
  }, []);
  const pick = (m: Mode) => {
    applyMode(m, true);
    setMode(m);
  };
  const choices: Array<[Mode, string]> = [
    ["light", t({ message: "Light", context: "settings: the light mode choice" })],
    ["dark", t({ message: "Dark", context: "settings: the dark mode choice" })],
  ];
  return (
    <div role="group" aria-label={t({ message: "Light or dark", context: "settings: the mode choice, read aloud" })} className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted p-1">
      {choices.map(([m, label]) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => pick(m)}
          className={`jw-btn min-h-11 rounded-lg px-4 text-sm font-semibold ${mode === m ? "bg-notice text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function ProfileSettings() {
  const { t } = useLingui();
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const config = useGameConfig();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<SettingsGroup | null>(() => {
    const h = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "");
    return isGroup(h) ? h : null;
  });
  const panelHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const groups: Record<SettingsGroup, { label: string; Icon: typeof Seed; words: string; body: ReactNode }> = {
    account: {
      label: t({ message: "Account", context: "settings: a group" }),
      Icon: Seed,
      words: t({ message: "email, address, time zone, booking link, agreements, sign out", context: "settings: words a search for the account group matches" }),
      body: (
        <>
          <AccountEmailsPanel />
          <section className={CARD}>
            <div className="grid gap-6">
              <TimeZoneField />
              <BookingLinkField />
            </div>
          </section>
          <AlignedSection />
          <button type="button" onClick={() => logout()} className={`${BTN_SECONDARY} self-start`}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t({ message: "Sign out", context: "Profile, button" })}
          </button>
        </>
      ),
    },
    privacy: {
      label: t({ message: "Privacy", context: "settings: a group" }),
      Icon: Held,
      words: t({ message: "who sees what, visitors, first name, roles, badges, standing, borrowed, booked, calendar, home", context: "settings: words a search for the privacy group matches" }),
      body: <PrivacyPanel />,
    },
    notifications: {
      label: t({ message: "Notifications and your data", context: "settings: a group" }),
      Icon: Firefly,
      words: t({ message: "email, digest, reminders, delete, leave, data", context: "settings: words a search for the notifications group matches" }),
      body: <NotifyPrefsPanel onDeleted={logout} />,
    },
    look: {
      label: t({ message: "Language and look", context: "settings: a group" }),
      Icon: SunLeaf,
      words: t({ message: "language, Spanish, English, light, dark, mode", context: "settings: words a search for the look group matches" }),
      body: (
        <section className={CARD}>
          <div className="grid gap-6">
            <div className="grid gap-2">
              <p className="font-semibold text-foreground">{t({ message: "Language", context: "settings: the language choice" })}</p>
              <LanguagePicker villageDefault={config?.defaultLocale ?? null} tone="onSheet" />
            </div>
            <div className="grid gap-2">
              <p className="font-semibold text-foreground">{t({ message: "Light or dark", context: "settings: the mode choice" })}</p>
              <ModeChoice />
              <p className={HINT}>{t({ message: "The switch at the top of every page changes the same thing.", context: "settings: under the mode choice" })}</p>
            </div>
          </div>
        </section>
      ),
    },
    inner: {
      label: t({ message: "Inner life", context: "settings: a group" }),
      Icon: Feather,
      words: t({ message: "Gene Keys, Human Design, lines, character, class", context: "settings: words a search for the inner life group matches" }),
      body: (
        <section className={CARD}>
          <div className="grid gap-3">
            <Link href="/profile/gene-keys" className={`${TILE} flex min-h-11 items-center justify-between gap-3 font-semibold text-foreground hover:border-notice`}>
              <span>{t({ message: "Your Gene Keys and Human Design", context: "settings: inner life door" })}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
            <Link href="/profile/characters" className={`${TILE} flex min-h-11 items-center justify-between gap-3 font-semibold text-foreground hover:border-notice`}>
              <span>{t({ message: "Your character", context: "settings: inner life door" })}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
            <p className={HINT}>{t({ message: "Who sees your lines, and whether your guide may use them, is chosen on that page.", context: "settings: inner life hint" })}</p>
          </div>
        </section>
      ),
    },
    agents: {
      label: t({ message: "Connected tools and agents", context: "settings: a group" }),
      Icon: Cell,
      words: t({ message: "guide, Sera, Maia, agent, token, key, inbox, assistant", context: "settings: words a search for the agents group matches" }),
      body: (
        <>
          <GuideChoiceCard />
          <div id="your-agent">
            <YourAgentPanel person={user?.id} />
          </div>
        </>
      ),
    },
  };

  const q = query.trim().toLowerCase();
  const shown = SETTINGS_GROUPS.filter((g) => !q || groups[g].label.toLowerCase().includes(q) || groups[g].words.toLowerCase().includes(q));
  const active: SettingsGroup = open ?? "account";

  const choose = (g: SettingsGroup) => {
    setOpen(g);
    try {
      window.history.replaceState(null, "", `#${g}`);
    } catch {
      /* the address stays as it was */
    }
    // The panel's heading takes focus, so a screen reader hears where the tap went.
    window.setTimeout(() => panelHeading.current?.focus(), 0);
  };
  const back = () => {
    setOpen(null);
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      /* the address stays as it was */
    }
  };

  if (loading || !user) return null;

  const { label, body } = groups[active];
  return (
    <Layout>
      <div className={`${WORLD} pb-32 pt-4 sm:py-10`}>
        <div className="mx-auto max-w-[1100px] px-4 sm:px-10">
          <Link href="/profile" className={`${LINK} inline-flex min-h-11 items-center gap-2 text-sm`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t({ message: "Back to your profile", context: "settings: the way back" })}
          </Link>
          <p className={`mt-2 ${EYEBROW}`}>{t({ message: "Only you see this", context: "settings: eyebrow" })}</p>
          <h1 className={H1}>{t({ message: "Profile settings", context: "settings: page title" })}</h1>

          <div className="mt-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-8">
            <nav aria-label={t({ message: "Settings groups", context: "settings: the list of groups, read aloud" })} className={`${open ? "max-lg:hidden" : ""} grid gap-3 lg:sticky lg:top-24`}>
              <label htmlFor={searchId} className="sr-only">
                {t({ message: "Search settings", context: "settings: the search box, read aloud" })}
              </label>
              <div className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t({ message: "Search, like: email", context: "settings: the search box" })}
                  className="min-h-11 w-full min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <ul className="grid gap-1 rounded-2xl border border-border bg-card p-2 shadow-sm">
                {shown.map((g) => {
                  const { Icon } = groups[g];
                  return (
                    <li key={g}>
                      <button
                        type="button"
                        onClick={() => choose(g)}
                        aria-current={active === g ? "page" : undefined}
                        data-settings-group={g}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-medium text-foreground hover:bg-muted ${active === g ? "lg:bg-muted lg:ring-1 lg:ring-notice" : ""}`}
                      >
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-notice text-background" aria-hidden="true">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">{groups[g].label}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground lg:hidden" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {shown.length === 0 ? <p className={HINT}>{t({ message: "Nothing matches. Try email, privacy or language.", context: "settings: a search with no match" })}</p> : null}
            </nav>

            <div className={`${open ? "" : "max-lg:hidden"} mt-6 grid gap-6 lg:mt-0`} data-settings-panel={active}>
              <button type="button" onClick={back} className={`${BTN_SECONDARY} self-start lg:hidden`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t({ message: "All settings", context: "settings: back to the list on a phone" })}
              </button>
              <h2 ref={panelHeading} tabIndex={-1} className="font-display text-3xl text-foreground focus:outline-none">
                {label}
              </h2>
              {body}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
