/**
 * The applicant's own cards on Today (the lead, 27 Nov 2026): their application's next step while it waits, and their
 * first week once adopted. Each draws nothing when it has nothing to say.
 */
import ApplicationNextCard from "@/components/profile/ApplicationNextCard";
import FirstWeekCard from "@/components/profile/FirstWeekCard";

export default function ApplicantCards() {
  return (
    <>
      <ApplicationNextCard />
      <FirstWeekCard />
    </>
  );
}
