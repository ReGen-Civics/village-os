/**
 * The count beside an account entry, in the avatar menu and the drawer: My tasks' open tasks, Messages' unread, and
 * Waiting on you's waiting things (NavLink.count). Each badge is its own lazy chunk, read only while the menu is open,
 * so the first page's scripts do not grow and nothing polls.
 */
import { Suspense, lazy } from "react";
import type { NavLink } from "@/config/nav";

const TaskCountBadge = lazy(() => import("@/components/tasks/TaskCountBadge"));
const MessageCountBadge = lazy(() => import("@/components/messages/MessageCountBadge"));
const WaitingCount = lazy(() => import("@/components/nav/WaitingCount"));

export default function AccountCount({ count, who }: { count: NavLink["count"]; who: string | number }) {
  if (!count) return null;
  return (
    <Suspense fallback={null}>
      {count === "tasks" ? <TaskCountBadge who={who} /> : count === "messages" ? <MessageCountBadge who={who} /> : <WaitingCount who={who} />}
    </Suspense>
  );
}
