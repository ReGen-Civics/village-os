import Layout from "@/components/Layout";
import { WORLD } from "@/components/journey/look";
import { readerLanguage } from "@/lib/readerLanguage";
import { useLocale } from "@/i18n/LocaleProvider";
import { m } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import { MushroomNetwork } from "@/components/sacred/living";
import { Link } from "wouter";
import { Image } from "@/components/Image";
import { useEffect, useState } from "react";
import { gameFetch, useGameConfig, useVillageLinks } from "@/lib/gameApi";
import { PeopleLockNote, type PeopleTier } from "@/components/PeopleLock";
import { readVillageSection } from "@/hooks/useVillageContent";
import { usePageContent, usePageLang } from "@/hooks/usePageContent";
import { Emphasized } from "@/components/PageText";
import { TEAM_PAGE } from "@shared/pageContent/team";
import { orgRowIsAgent, seatHistoryShown } from "@shared/roleSheetInputs";
import { Trans } from "@lingui/react/macro";

interface TeamMember {
  name: string;
  role: string;
  circle?: string;
  bio?: string;
  photo?: string;
}

/**
 * How many roles have a place nobody holds, from the counts /api/org gives
 * every reader. An example role is the platform's, never this village's
 * opening. The page used to say "several roles are open right now" under a
 * village with every role filled; this is what it asks first now.
 */
export function openRoleCount(roles: ReadonlyArray<{ seats?: unknown; holderCount?: unknown; isExample?: unknown }>): number {
  return roles.filter((r) => !r.isExample && Number(r.holderCount ?? 0) < Number(r.seats ?? 1)).length;
}

/**
 * WHETHER THIS READER GETS THE TEAM CARDS: photos, bios and the full names on them (the lead, 25 Nov 2026).
 *
 * A visitor reads first names only on /team, from /api/org, which already says "A member" for whoever turned off
 * "Show my first name to visitors". The cards carry what a stranger must not get: a surname, a portrait, a bio.
 * They used to merge for everyone, and because a public holder row is a first name and a card is a full name the
 * two never matched, so each card was drawn again on its own, surname and photo included. A member keeps today's
 * page. The member tier is proved the way the seat history proves it: signed in, and rows that carry `kind`.
 * The server holds the same line (`teamCardsFor`, server/lib/teamCards.ts); this is the page's half.
 */
export function teamCardsShown(people: PeopleTier | null | undefined, roles: unknown): boolean {
  return !!people?.signedIn && seatHistoryShown(people, roles);
}

/** A board column's lines, blanks left out. */
const columnLines = (column: Readonly<Record<string, string>>) =>
  [column.first, column.second, column.third, column.fourth].filter((line) => (line ?? "").trim() !== "");

export default function Team() {
  const { locale } = useLocale(); // circle names come in the reader's language (lib/readerLanguage.ts)
  const config = useGameConfig();
  // Every word on this page that is not a person's is the village's own, from
  // Admin, Pages, Team (shared/pageContent/team.ts). Null until the saved
  // words have arrived, so the defaults never flash first.
  const langOf = usePageLang(TEAM_PAGE);
  const page = usePageContent(TEAM_PAGE);
  // Blank hides the button rather than pointing at another village.
  const { eventsUrl } = useVillageLinks();
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  /* A team that could not be read is not an empty team (whole-app QA, 25 Nov 2026). */
  const [teamFailed, setTeamFailed] = useState(false);
  // The tier this page's copy of /api/org came back at, plus the two counts
  // that are public on every tier. Held for the lock note below.
  const [people, setPeople] = useState<PeopleTier | null>(null);
  const [seatCounts, setSeatCounts] = useState({ seats: 0, held: 0, open: 0 });

  useEffect(() => {
    // Two sources, merged. Seats and their holders come from the org rows
    // (0049), so anyone actually holding a seat appears here without being
    // added to a second list by hand. The team cards still supply photos and
    // bios, matched by name, because a row has no portrait.
    //
    // Before this the Team page was its own hand-kept list, and it showed two
    // people out of the eight who held seats.
    //
    // `gameFetch` CARRIES THE TOKEN and a bare `fetch` does not, which is the
    // whole reason this line changed. `/api/org` tiers its holder names
    // behind `map.viewPeople`, `authedUser` reads the Authorization header
    // alone with no cookie fallback, and this page had never sent one: the
    // capability was therefore consulted on a viewer that was always null,
    // and it had never granted anybody anything here.
    gameFetch("/api/org", readerLanguage(locale))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      // The cards are asked for only at the member tier (teamCardsShown), so a
      // visitor's browser never holds a surname or a portrait. Through the
      // section listing, so a fork that has written no team cards never
      // requests them (see client/src/hooks/useVillageContent.ts).
      .then(async (org: any) => [
        org,
        teamCardsShown(org.people, org.roles) ? await readVillageSection("team").then((cards) => (Array.isArray(cards) ? cards : [])).catch(() => []) : [],
      ] as const)
      .then(([org, cards]) => {
        setPeople(org.people ?? null);
        setSeatCounts({
          seats: (org.roles ?? []).reduce((n: number, r: any) => n + Number(r.seats ?? 0), 0),
          held: (org.roles ?? []).reduce((n: number, r: any) => n + Number(r.holderCount ?? 0), 0),
          open: openRoleCount(org.roles ?? []),
        });
        // A visitor never gets the cards, so nothing below can draw a surname or a photo for them.
        const shownCards: any[] = teamCardsShown(org.people, org.roles) ? [...cards] : [];
        const profileByName = new Map<string, any>();
        for (const c of shownCards) {
          if (c?.name) profileByName.set(String(c.name).trim().toLowerCase(), c);
        }
        const circleName = new Map<string, string>(
          (org.circles ?? []).map((c: any) => [c.id, c.name]),
        );
        // One entry per person, carrying every seat they hold.
        const seatsByPerson = new Map<string, { name: string; seats: string[]; circle?: string }>();
        for (const r of org.roles ?? []) {
          for (const h of r.holders ?? []) {
            // An agent is not a person on the team. Its member row carries a
            // vendor's product name and its public row reads "An agent", and
            // either one would become a person's card here.
            if (!h?.name || orgRowIsAgent(h)) continue;
            const key = String(h.name).trim().toLowerCase();
            const entry = seatsByPerson.get(key) ?? {
              name: String(h.name).trim(),
              seats: [],
              circle: circleName.get(r.circleId) ?? undefined,
            };
            entry.seats.push(h.focus ? `${r.name} (${h.focus})` : r.name);
            seatsByPerson.set(key, entry);
          }
        }
        const merged: TeamMember[] = Array.from(seatsByPerson.values()).map((p) => {
          const card = profileByName.get(p.name.toLowerCase());
          return {
            name: card?.name ?? p.name,
            role: p.seats.join(" · "),
            /*
             * THE LIVE CIRCLE NAME WINS OVER THE CARD'S.
             *
             * These two were the other way around, so a founder who renamed a
             * circle in Admin, Org Chart watched /circles and /roles update and
             * /team keep printing the old name, out of the same team-card store
             * the banner above that editor says the public pages no longer
             * read. The card still supplies what a seat row has no place for, a
             * portrait and a bio, and it fills in the circle only for somebody
             * whose seat sits in none.
             */
            circle: p.circle ?? card?.circle,
            bio: card?.bio,
            photo: card?.photo,
          };
        });
        // A card for somebody who holds no seat still belongs on the page.
        for (const c of shownCards) {
          if (!c?.name) continue;
          if (!seatsByPerson.has(String(c.name).trim().toLowerCase())) merged.push(c);
        }
        setTeam(merged);
      })
      .catch(() => setTeamFailed(true));
  }, [locale]);

  return (
    <Layout>
      {/* The night world (public launch, 24 Nov 2026): the sheet's look, same words. */}
      <div className={WORLD}>
      <section className="py-24">
        <div className="container">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="w-16 h-16 rounded-full bg-open/10 flex items-center justify-center mx-auto mb-6">
              <MushroomNetwork className="w-8 h-8 text-open" />
            </div>
            {/* The heading and the sentence under it used to name one village
                and describe that village's founding team, so every fork of this
                platform published a claim about four people it had never met.
                The name comes from the live config now, and the sentence says
                only what is true of any village reading it. */}
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              {config?.project?.name ? `The ${config.project.name} Team` : "The Team"}
            </h1>
            <p className={`text-xl text-muted-foreground max-w-2xl mx-auto break-words${page ? "" : " invisible"}`}>
              <Emphasized text={page?.header.fields.intro || "\u00a0"} />
            </p>
          </m.div>

          {/* Leadership */}
          <div className="mb-20">
            <div
              className="m-germ text-center mb-12"
            >
              <h2 className={`font-display text-3xl font-bold text-foreground mb-4 break-words${page ? "" : " invisible"}`}>
                {page?.leadership.fields.heading || "\u00a0"}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                <Trans context="Team, p">The full circle of roles, filled and open, lives on the{" "}
                <Link href="/roles" className="text-open font-medium hover:underline">Roles &amp; Circles page</Link>.
              </Trans></p>
            </div>

            {/* Members-only people: say so, with the counts that stay public.
                Without this the grid below simply renders short and a visitor
                reads a busy village as an empty one. */}
            <div className="mb-12">
              <PeopleLockNote people={people} seats={seatCounts.seats} held={seatCounts.held} />
            </div>

            {/* R55: a village with nobody seated yet is new, not failing. The
                grid used to render zero cards under three headings, which reads
                as a broken page rather than an early one, and it read that way
                on a fork's very first day. */}
            {teamFailed && team === null ? (
              <p role="alert" className="mx-auto max-w-xl rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
                <Trans context="team page: the team read failed">The team didn't load. Refresh the page in a moment to see who holds the roles.</Trans>
              </p>
            ) : null}
            {team !== null && team.length === 0 && people?.visible ? (
              <p className="text-center text-muted-foreground max-w-xl mx-auto">
                <Trans context="Team, p">No one has joined the team yet. Team members appear on this
                page as roles are filled.
              </Trans></p>
            ) : null}

            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              {(team ?? []).map((member, index) => (
                <m.div
                  key={member.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -6 }}
                  className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-sm transition-all border border-border"
                >
                  {member.photo && (
                    <div className="h-64 overflow-hidden">
                      <Image
                        src={member.photo}
                        alt={member.name}
                        className="w-full h-full"
                        imgClassName="object-top"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="font-display text-xl font-bold text-foreground mb-1">
                      {member.name}
                    </h3>
                    <p className="text-open font-semibold text-sm mb-2">
                      {member.role}
                    </p>
                    {member.circle && (
                      <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border">
                        {member.circle}
                      </p>
                    )}
                    {member.bio && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {member.bio}
                      </p>
                    )}
                  </div>
                </m.div>
              ))}
            </div>

            {/* Said only while a role really is open: counted from /api/org,
                whose seat counts every reader gets. */}
            {page && seatCounts.open > 0 && (
            <div
              className="m-germ text-center mt-10"
            >
              {page.leadership.fields.openNote && (
              <p lang={langOf("leadership.openNote")} className="text-muted-foreground text-sm max-w-xl mx-auto mb-4 break-words">
                <Emphasized text={page.leadership.fields.openNote} />
              </p>
              )}
              <Link href="/roles" className="inline-flex items-center gap-2 text-open font-semibold hover:underline">
                {page.leadership.fields.openLink} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            )}
          </div>

          {/* Advisory Council: drawn once the village lists someone on it, and
              a village can hide it in Admin, Pages, Team. It ships with no
              lines, so a village that has no council never shows an empty
              box claiming one. */}
          {page && !page.advisory.hidden && page.advisory.lists.items.length > 0 && (
          <div
            className="m-germ bg-card rounded-2xl p-6 sm:p-8 md:p-12 border border-border mb-20"
          >
            <div className="text-center mb-10">
              <h2 lang={langOf("advisory.heading")} className="font-display text-3xl font-bold text-foreground mb-4 break-words">
                {page.advisory.fields.heading}
              </h2>
              <p lang={langOf("advisory.intro")} className="text-muted-foreground max-w-2xl mx-auto break-words">
                <Emphasized text={page.advisory.fields.intro} />
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-8">
              {page.advisory.lists.items.map((item, index) => (
                <div
                  key={`${index}-${item.text}`}
                  className="m-germ flex gap-3 items-start"
                >
                  <span className="text-notice font-bold text-lg flex-shrink-0">✦</span>
                  <p className="text-muted-foreground min-w-0 break-words">{item.text}</p>
                </div>
              ))}
            </div>
            {page.advisory.fields.terms && (
            <p lang={langOf("advisory.terms")} className="text-center text-sm text-muted-foreground break-words">
              <Emphasized text={page.advisory.fields.terms} />
            </p>
            )}
          </div>
          )}

          {/* Board: drawn once it has a column, the same rule as the council. */}
          {page && !page.board.hidden && page.board.lists.columns.length > 0 && (
          <div
            className="m-germ bg-card rounded-2xl p-6 sm:p-8 md:p-12 border border-border mb-20"
          >
            <div className="text-center">
              <h2 lang={langOf("board.heading")} className="font-display text-3xl font-bold text-foreground mb-4 break-words">
                {page.board.fields.heading}
              </h2>
              <p lang={langOf("board.intro")} className="text-muted-foreground max-w-2xl mx-auto mb-8 break-words">
                <Emphasized text={page.board.fields.intro} />
              </p>
              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {page.board.lists.columns.map((column, index) => (
                <div key={`${index}-${column.heading}`} className="text-left min-w-0">
                  <h3 className="font-semibold text-foreground mb-2 break-words">{column.heading}</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {columnLines(column).map((line, i) => (
                      <li key={`${i}-${line}`} className="break-words">{line}</li>
                    ))}
                  </ul>
                </div>
                ))}
              </div>
            </div>
          </div>
          )}

          {/* CTA */}
          {page && !page.cta.hidden && (
          <div
            className="m-germ text-center mt-16 bg-card p-6 sm:p-8 rounded-2xl border border-border"
          >
            <h2 lang={langOf("cta.heading")} className="font-display text-2xl font-bold text-foreground mb-4 break-words">
              {page.cta.fields.heading}
            </h2>
            <p lang={langOf("cta.body")} className="text-muted-foreground max-w-2xl mx-auto mb-6 break-words">
              <Emphasized text={page.cta.fields.body} />
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/#choose-path">
                <span className="inline-flex items-center gap-2 px-6 py-3 bg-notice text-background rounded-xl hover:bg-notice/90 transition-colors font-medium cursor-pointer">
                  {page.cta.fields.pathLabel}
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              {eventsUrl && (
                <a
                  href={eventsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
                >
                  {page.cta.fields.callLabel}
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
          )}
        </div>
      </section>
      </div>
    </Layout>
  );
}
