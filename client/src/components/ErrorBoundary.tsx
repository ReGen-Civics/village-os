import { reportCrash } from "@/lib/crashReport";
import { isChunkLoadError, isOnline, reloadOnceForStaleChunk } from "@/lib/staleChunk";
import { i18n } from "@lingui/core";
import { Trans } from "@lingui/react/macro";
import { RotateCcw } from "lucide-react";
import { Component, ReactNode, useEffect, useState } from "react";
import type { ReloadQuote } from "@shared/reloadQuotes";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /**
   * The error was a page chunk that did not arrive (lib/staleChunk.ts): the
   * page outlived a deploy. `reloading` is true while the one automatic
   * reload happens, false when it was not allowed and the card shows, and
   * undefined for the moment before componentDidCatch decides.
   */
  stale?: boolean;
  reloading?: boolean;
  /** The chunk failed while the browser was offline: no reload, the offline card (resilience P2-4). */
  offline?: boolean;
}

/**
 * THE REFRESH SCREEN (public launch, 24 Nov 2026). The lead asked for it to be
 * playful and plain: one big button, a line saying nothing is broken, and a
 * different quote from the old nature writers and the Daoist classics each
 * time (shared/reloadQuotes.ts holds the list and its rules).
 *
 * It must draw when the app's own chunks will not load, so the screen lives
 * here in the boot chunk, written as class strings in the sheet's look
 * (docs/DESIGN_RULE.md) with a few lines of inline SVG for its picture.
 * Every byte here is on every route's first view, which is at its budget, so
 * it stays small: the quote list is a chunk of its own, fetched when the
 * screen shows. That file imports nothing, so its name survives most deploys
 * and a page that outlived one still finds it; when it does not, the screen
 * simply has no quote.
 */
function QuoteOfTheMoment() {
  const [quote, setQuote] = useState<ReloadQuote | null>(null);
  useEffect(() => {
    let live = true;
    import("@shared/reloadQuotes").then((m) => live && setQuote(m.nextReloadQuote()), () => {});
    return () => {
      live = false;
    };
  }, []);
  if (!quote) return null;
  const es = i18n.locale.startsWith("es");
  return (
    <figure className="mt-8 w-full rounded-xl border border-border bg-muted p-5 text-left">
      <blockquote className="font-display text-lg leading-relaxed text-foreground" lang={es ? "es" : "en"}>
        {es ? quote.es : quote.text}
      </blockquote>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        {quote.by}, <cite className="not-italic">{quote.source}</cite>
      </figcaption>
    </figure>
  );
}

/** A sprout, unfurling once (index.css .jw-unfurl, still under reduced motion). */
const SPROUT = (
  <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true" className="jw-unfurl mb-4 text-open">
    <path d="M32 58V30M10 58c14-6 30-6 44 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M32 38C30 28 22 22 12 22c1 10 9 16 20 16zM32 32c2-10 10-17 21-17-1 11-9 17-21 17z" fill="currentColor" />
  </svg>
);

const LINK = "mt-5 inline-flex min-h-11 items-center text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground";

/**
 * The card every "please refresh" state shares: the night ground, one gold
 * panel, a sprout, the heading (role="alert", so a screen reader hears that the
 * page changed), one big button, then whatever the state adds.
 */
function RefreshCard({
  eyebrow,
  heading,
  body,
  button,
  onPress = () => window.location.reload(),
  quote = true,
  children,
}: {
  eyebrow: ReactNode;
  heading: ReactNode;
  body?: ReactNode;
  button?: ReactNode;
  onPress?: () => void;
  quote?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="relative sheet-night flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-lg flex-col items-center rounded-2xl border-2 border-notice/60 bg-card p-6 text-center shadow-sm sm:p-10">
        {SPROUT}
        <p className="text-xs font-semibold uppercase tracking-widest text-notice">{eyebrow}</p>
        <h1 role="alert" className="mt-2 mb-3 font-display text-3xl leading-tight text-card-foreground sm:text-4xl">
          {heading}
        </h1>
        {body && <p className="mb-4 text-base leading-relaxed text-muted-foreground">{body}</p>}
        <button
          type="button"
          onClick={onPress}
          className="jw-btn mt-3 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-notice px-6 py-3 text-lg font-semibold text-background shadow-sm hover:bg-notice/90 cursor-pointer sm:w-auto sm:min-w-64"
        >
          <RotateCcw size={20} aria-hidden="true" />
          {button ?? <Trans context="refresh screen: the one button, reloads the page">Refresh the page</Trans>}
        </button>
        {children}
        {quote && <QuoteOfTheMoment />}
      </div>
    </main>
  );
}

/**
 * THE OFFLINE CARD. A page chunk that failed while the browser was offline is
 * not an old build, so nothing reloads (a reload would land on the browser's
 * own offline page). The member reconnects and taps try again; the boundary is
 * keyed on the address, so going back also brings the last page back. No
 * quote: its file could not arrive offline anyway.
 */
export function OfflineCard() {
  const [stillOffline, setStillOffline] = useState(false);
  return (
    <RefreshCard
      eyebrow={<Trans context="refresh screen when offline: the eyebrow">No connection</Trans>}
      heading={<Trans context="offline card: the device has no connection">You're offline</Trans>}
      body={<Trans>We'll keep your answers. When you're back online, tap try again.</Trans>}
      button={<Trans context="offline card: load the page again">Try again</Trans>}
      onPress={() => (isOnline() ? window.location.reload() : setStillOffline(true))}
      quote={false}
    >
      {stillOffline && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          <Trans>Still offline. Check your connection.</Trans>
        </p>
      )}
    </RefreshCard>
  );
}

/** A page opened before a deploy, after the one automatic reload did not bring it back. */
export function StaleBuildCard() {
  return (
    <RefreshCard
      eyebrow={<Trans context="refresh screen after a deploy: the eyebrow">A fresh version is here</Trans>}
      heading={<Trans>The site just grew</Trans>}
      body={<Trans>Nothing is broken. One refresh brings you the new version.</Trans>}
    >
      <a href="/reset" className={LINK}>
        <Trans>Still stuck? Give this device a fresh start</Trans>
      </a>
    </RefreshCard>
  );
}

/**
 * Any other crash: the same screen, honest that the page tripped, with a way
 * home (the boundary sits outside the page's own header) and the stack one
 * tap away for a bug report, off the alert heading so nobody hears it read.
 */
function CrashCard({ stack }: { stack?: string }) {
  return (
    <RefreshCard
      eyebrow={<Trans context="refresh screen after a crash: the eyebrow">A small stumble</Trans>}
      heading={<Trans context="refresh screen after a crash: the heading">This page didn't load</Trans>}
      body={<Trans>A refresh usually brings it back.</Trans>}
    >
      <a href="/" className={LINK}>
        <Trans context="refresh screen after a crash: leave for the home page">Go to the home page</Trans>
      </a>
      {stack && (
        <details className="mt-4 w-full text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            <Trans>Details for a bug report</Trans>
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-break-spaces rounded-lg bg-muted p-3 text-xs text-muted-foreground">{stack}</pre>
        </details>
      )}
    </RefreshCard>
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, stale: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error) {
    // One reload for a page that outlived a deploy; the card if that already happened.
    // Offline, a missing chunk is the connection, not the build: no reload, the offline card.
    if (isChunkLoadError(error)) {
      if (!isOnline()) this.setState({ reloading: false, offline: true });
      else {
        const reloading = reloadOnceForStaleChunk();
        this.setState({ reloading });
        // A reload that brings the page back is a deploy, not a crash. One
        // that was not allowed leaves the member on the card: say so.
        if (!reloading) reportCrash(error, "boundary");
      }
      return;
    }
    // Every other crash screen tells the server, once (lib/crashReport.ts).
    reportCrash(error, "boundary");
  }

  render() {
    if (this.state.hasError && this.state.stale) {
      if (this.state.offline) return <OfflineCard />;
      // While the reload happens, the plain ground: a card flashing for a
      // moment before the page goes away would only alarm.
      if (this.state.reloading !== false) return <div className="min-h-screen bg-background" />;
      return <StaleBuildCard />;
    }

    if (this.state.hasError) return <CrashCard stack={this.state.error?.stack} />;

    return this.props.children;
  }
}

export default ErrorBoundary;
