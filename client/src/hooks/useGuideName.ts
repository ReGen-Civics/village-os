import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLingui } from "@lingui/react/macro";
import { guideAudience, type GuideAudience, type GuideName } from "@shared/guideName";
import { guideNameIn } from "@/lib/guideNameWords";
import { pastTheEntrance } from "@/lib/entranceStatus";

/**
 * The village guide's name for whoever is looking, on a page that does not
 * already read the Work With Us document itself.
 *
 * The name is `workWithUs.assistantName` (shared/guideName.ts says why it is
 * the only place). Until the village names its guide this reads "your village
 * guide" to a founder or admin and "the village guide" to everyone else, so
 * the guide is never hidden and never borrows another village's name. The
 * neutral label is said in the reader's language (client/src/lib/guideNameWords.ts);
 * a name the village typed is shown exactly as typed in every language.
 *
 * `loaded` turns true once the document has answered or failed, for a page
 * that would rather wait than show the neutral label and then the name.
 */
export function useGuideName(): GuideName & { loaded: boolean; audience: GuideAudience } {
  const user = useViewer();
  const audience = guideAudience(user);
  const signedIn = !!user;
  const { i18n } = useLingui();
  const [source, setSource] = useState<unknown>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    const done = (value: unknown) => {
      if (!live) return;
      setSource(value);
      setLoaded(true);
    };
    // A visitor in front of the portal entrance is refused every read past it, so the name is not asked until this
    // device has entered (lib/entranceStatus.ts): the neutral label stands meanwhile. Signed out on the entrance,
    // 1.3.75 logged a refused read and a console error on every page load.
    void (signedIn ? Promise.resolve(true) : pastTheEntrance())
      .then((past) => {
        if (!past) return done(undefined);
        return fetch("/api/work-with-us-config")
          .then((r) => (r.ok ? r.json() : null))
          .then((w) => done(w?.assistantName));
      })
      .catch(() => done(undefined));
    return () => {
      live = false;
    };
  }, [signedIn]);

  return { ...guideNameIn(source, audience, i18n), loaded, audience };
}

/** The signed-in user, or null signed out and on a tree with no auth provider (a page rendered bare). */
function useViewer(): { role?: string | null } | null {
  let user: { role?: string | null } | null | undefined;
  try {
    user = useAuth().user;
  } catch {
    user = null;
  }
  return user ?? null;
}

/**
 * Who is looking, as the guide's name needs it. Signed out, or on a tree with
 * no auth provider (a page rendered bare), the viewer is the public: the
 * neutral label is the safe answer and grants nothing.
 */
export function useViewerGuideAudience(): GuideAudience {
  return guideAudience(useViewer());
}
