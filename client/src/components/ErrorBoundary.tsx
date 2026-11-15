import { isChunkLoadError, isOnline, reloadOnceForStaleChunk } from "@/lib/staleChunk";
import { cn } from "@/lib/utils";
import { Trans } from "@lingui/react/macro";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode, useState } from "react";

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
 * What a member sees when this page was opened before an update and a reload
 * did not bring it back on its own. Plain words and one button; the link is
 * for the rare device that stays stuck (pages/Reset.tsx).
 */
/**
 * THE OFFLINE CARD. A page chunk that failed while the browser was offline is
 * not an old build, so nothing reloads (a reload would land on the browser's
 * own offline page). The member reconnects and taps try again; the boundary is
 * keyed on the address, so going back also brings the last page back.
 */
export function OfflineCard() {
  const [stillOffline, setStillOffline] = useState(false);
  return (
    <div className="relative sheet-night flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <h2 role="alert" className="font-display text-2xl font-bold text-card-foreground mb-3">
          <Trans context="offline card: the device has no connection">You're offline</Trans>
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground mb-6">
          <Trans>We'll keep your answers. When you're back online, tap try again.</Trans>
        </p>
        <button
          type="button"
          onClick={() => (isOnline() ? window.location.reload() : setStillOffline(true))}
          className="jw-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-notice px-5 py-2 font-semibold text-background hover:bg-notice/90 cursor-pointer"
        >
          <RotateCcw size={16} aria-hidden="true" />
          <Trans context="offline card: load the page again">Try again</Trans>
        </button>
        {stillOffline && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            <Trans>Still offline. Check your connection.</Trans>
          </p>
        )}
      </div>
    </div>
  );
}

export function StaleBuildCard() {
  return (
    <div className="relative sheet-night flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <h2 role="alert" className="font-display text-2xl font-bold text-card-foreground mb-3">
          <Trans>We just updated the site</Trans>
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground mb-6">
          <Trans>Tap reload to get the new version.</Trans>
        </p>
        <button
          onClick={() => window.location.reload()}
          className="jw-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-notice px-5 py-2 font-semibold text-background hover:bg-notice/90 cursor-pointer"
        >
          <RotateCcw size={16} />
          <Trans context="update card: reload the page">Reload</Trans>
        </button>
        <a href="/reset" className="mt-5 text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground">
          <Trans>Still stuck? Give this device a fresh start</Trans>
        </a>
      </div>
    </div>
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
      else this.setState({ reloading: reloadOnceForStaleChunk() });
    }
  }

  render() {
    if (this.state.hasError && this.state.stale) {
      if (this.state.offline) return <OfflineCard />;
      // While the reload happens, the plain ground: a card flashing for a
      // moment before the page goes away would only alarm.
      if (this.state.reloading !== false) return <div className="min-h-screen bg-background" />;
      return <StaleBuildCard />;
    }

    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            {/* role="alert": when the boundary trips it replaces the page
                the member was on, and until now it did so silently - a screen
                reader kept reading the tree it had, which is gone. The role
                goes on the heading and not the wrapper on purpose: the
                wrapper holds the stack trace, and reading a stack aloud
                helps nobody. */}
            <h2 role="alert" className="text-xl mb-4">This page didn't load. Reload to try again.</h2>

            {/* R47: a player needs the way forward, not the stack. It stays
                one tap away for whoever reports the bug. */}
            <details className="w-full mb-6">
              <summary className="cursor-pointer text-sm text-muted-foreground mb-2">Details for a bug report</summary>
              <div className="p-4 w-full rounded bg-muted overflow-auto">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error?.stack}
                </pre>
              </div>
            </details>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
