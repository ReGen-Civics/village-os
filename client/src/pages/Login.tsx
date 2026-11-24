import { useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useGoogleSignInReturn } from "@/components/auth/useGoogleSignInReturn";
import { useAuth } from "@/contexts/AuthContext";
import { afterSignIn } from "@/lib/internalPath";
import { m } from "framer-motion";
import { Heart, ArrowRight, Mail, Lock } from "lucide-react";
import { useState } from "react";
import { ShowPasswordButton } from "@/components/auth/ShowPasswordButton";
import { useLocation } from "wouter";
import { failureWords } from "@/lib/failureWords";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, FIELD, H1, LABEL, LINK, RING, WORLD } from "@/components/journey/look";

export default function Login() {
  const { t } = useLingui();
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Google sends members back to this page. The hook finishes the exchange and
  // reloads onto the destination, so the only thing this page renders for it is
  // a waiting line or a refusal.
  const googleReturn = useGoogleSignInReturn();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // A sign-in that started on a members-only page goes back there (R36).
      // Internal paths only (lib/internalPath.ts), so a crafted link cannot
      // bounce anyone offsite.
      navigate(afterSignIn(new URLSearchParams(window.location.search).get("next")));
    } catch (err) {
      setError(failureWords(err, t({ message: "Sign-in didn't work. Check your email and password.", context: "sign in: when it fails" })));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className={`${WORLD} py-16`}>
        <div className="container">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <span className={`${RING} size-16`} aria-hidden="true">
                  <Heart className="w-8 h-8" />
                </span>
              </div>
              {/*
                It used to say "Welcome Back" to everybody, and `/profile` is
                linked from the footer of every public page, so the person who
                met that line most often was somebody arriving for the first
                time. A member's own words: "It welcomed me back and I had
                never been here."

                And the page cannot tell the difference. The one thing that
                counts visits is `recordVisit()` in landing.ts, which runs
                inside `LandingRoute` alone, so a visitor who follows a link
                straight to a sign-in form never increments it. There is no
                fact here to build a greeting on, so the heading says what
                the page is, which is also what the tab already says.
              */}
              <h1 className={`${H1} mb-2`}>{t({ message: "Sign in", context: "sign in: the page heading" })}</h1>
              <p className="text-muted-foreground">
                {t({ message: "Members sign in here.", context: "sign in: under the heading" })}
              </p>
            </div>

            <form onSubmit={handleSubmit} className={`${CARD} space-y-6`}>
              {/*
                A Google round trip that failed says so here, in the same
                spoken box a failed password gets. Silence would leave a
                member staring at a sign-in form with no idea their click
                went anywhere.
              */}
              {googleReturn.status === "failed" && (
                <div role="alert" className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                  {googleReturn.message}
                </div>
              )}
              {googleReturn.status === "working" && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t({ message: "Finishing your Google sign-in.", context: "sign in: while a Google sign-in finishes" })}
                </p>
              )}
              {/*
                role="alert" so a failed sign-in is SPOKEN. A red box that
                only appears visually leaves a screen-reader user pressing
                the same button again with no idea why nothing happened.
              */}
              {error && (
                <m.div
                  role="alert"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm"
                >
                  {error}
                </m.div>
              )}

              {/*
                htmlFor + id, so the label is ATTACHED to the field rather
                than merely sitting above it. Without the pair, a screen
                reader announces "edit text, blank" and a tap on the word
                "Email" does nothing — on the sign-in form, the one page
                every single member has to get through.
              */}
              <div>
                <label htmlFor="login-email" className={`${LABEL} mb-2 block`}>{t({ message: "Email", context: "account forms: field label" })}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="login-email"
                    name="email"
                    autoComplete="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`${FIELD} w-full pl-12 pr-4 py-3`}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className={`${LABEL} mb-2 block`}>{t({ message: "Password", context: "account forms: field label" })}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="login-password"
                    name="password"
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${FIELD} w-full pl-12 pr-12 py-3`}
                    required
                  />
                  <ShowPasswordButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                </div>
              </div>

              <button disabled={loading} type="submit" className={`${BTN_PRIMARY} w-full py-3`}>
                {loading ? t({ message: "Signing in…", context: "sign in: the button while it works" }) : t({ message: "Sign in", context: "sign in: the button" })}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>

              <p className="text-center">
                <a href="/forgot-password" className={`${LINK} inline-flex min-h-11 items-center text-sm`}>
                  {t({ message: "Forgot your password?", context: "sign in: link" })}
                </a>
              </p>

              {/*
                An ADDITIONAL way in, never a replacement. The form above stays
                exactly where it was, because a village will have members with
                no Google account. On a village that configured no Google
                credentials this renders nothing at all.
              */}
              <GoogleSignInButton next={afterSignIn(new URLSearchParams(window.location.search).get("next"))} />
            </form>

            <div className="mt-8 text-center">
              <p className="text-muted-foreground mb-4">{t({ message: "New here?", context: "sign in: for someone with no account" })}</p>
              <a href="/register" className={BTN_SECONDARY}>
                {t({ message: "Create an account", context: "sign in: for someone with no account" })}
                <ArrowRight className="w-5 h-5" />
              </a>
              {/* The second way to ask to join (Rye, 2026-09-09): in a village
                  that joins by invitation, somebody here with no account and
                  no link is exactly who needs it. */}
              <p className="mt-4 text-sm text-muted-foreground">
                {t({ message: "No invitation yet?", context: "sign in: for someone with no invitation" })}{" "}
                <a href="/request-membership" className={LINK}>
                  {t({ message: "Ask to join", context: "sign in: for someone with no invitation" })}
                </a>
              </p>
            </div>
          </m.div>
        </div>
      </div>
    </Layout>
  );
}
