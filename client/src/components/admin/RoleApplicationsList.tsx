/**
 * The waiting role applications as rows, each a link to the application's own
 * page. Today and the Inbox both draw it (roleApplicationsWaiting.ts).
 */
import type { RoleApplicationRow } from "./roleApplicationsWaiting";
import { roleApplicationsSentence } from "./roleApplicationsWaiting";

export default function RoleApplicationsList({ rows, heading = "Role applications" }: { rows: RoleApplicationRow[]; heading?: string }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={heading} className="rounded-xl border border-gray-200 bg-white p-4" data-role-applications-waiting={rows.length}>
      <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
      <p className="mt-1 text-sm text-gray-700">{roleApplicationsSentence(rows.length)}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <a
              href={row.href}
              data-role-application-row={row.id}
              className="flex min-h-[44px] w-full flex-col items-start rounded-xl border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-base font-medium text-gray-900">{row.who}</span>
              <span className="text-sm text-gray-800">{row.role}</span>
              <span className="text-sm text-gray-700">{row.when} · {row.status}</span>
              <span className="text-sm font-medium text-teal-deep underline underline-offset-2">Open the role application</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
