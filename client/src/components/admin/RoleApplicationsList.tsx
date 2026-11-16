/**
 * The waiting role applications as rows, each a link to the application's own
 * page. Today and the Inbox both draw it (roleApplicationsWaiting.ts).
 */
import { useLingui } from "@lingui/react/macro";
import type { RoleApplicationRow } from "./roleApplicationsWaiting";
import { roleApplicationsSentence } from "./roleApplicationsWaiting";

export default function RoleApplicationsList({ rows, heading }: { rows: RoleApplicationRow[]; heading?: string }) {
  const { t } = useLingui();
  if (rows.length === 0) return null;
  const title = heading ?? t({ message: "Role applications", context: "admin role applications waiting" });
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-4 text-card-foreground" data-role-applications-waiting={rows.length}>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{roleApplicationsSentence(rows.length)}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <a
              href={row.href}
              data-role-application-row={row.id}
              className="flex min-h-[44px] w-full flex-col items-start rounded-xl border border-border bg-card px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-base font-medium text-foreground">{row.who}</span>
              <span className="text-sm text-foreground">{row.role}</span>
              <span className="text-sm text-muted-foreground">{row.when} · {row.status}</span>
              <span className="text-sm font-medium text-teal-deep underline underline-offset-2">
                {t({ message: "Open the role application", context: "admin role applications waiting" })}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
