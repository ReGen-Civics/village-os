/**
 * THE MEMBER'S MOMENTS, mounted once by Layout for a signed-in member: the
 * notification toasts (and the page's single polite live region), the reward
 * moment, and the season summary offer.
 *
 * One lazy chunk, because none of the three draws anything on arrival: each
 * waits for a poll or a stored moment, so a visitor who is not signed in never
 * downloads them, and a member gets them a moment after the page. That keeps
 * them off the first page's scripts, the tight client budget (MAX_BOOT_JS_KB).
 * One chunk rather than three because the total is block-charged.
 */
import NotificationToasts from "@/components/NotificationToasts";
import RewardMoment from "@/components/RewardMoment";
import SeasonSummaryOffer from "@/components/seasonSummary/SeasonSummaryOffer";

export default function MemberMoments() {
  return (
    <>
      <NotificationToasts />
      <RewardMoment />
      <SeasonSummaryOffer /> {/* idea 4: once, after a season turns */}
    </>
  );
}
