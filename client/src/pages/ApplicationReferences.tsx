/**
 * AN APPLICATION'S REFERENCES PAGE, FOR THE TEAM (the lead, 27 Nov 2026: "a link for the reference page ... to be able
 * to share with the team the references and let different team members follow up with them and mark them done").
 *
 * A shareable address, /open-proposals/:id/references, for team members only: the people who may see the application
 * today (its walkthrough's door, which answers 404 to the applicant, to anyone who stepped out and to outsiders, and
 * then nothing is drawn). Each reference with its contact details; a team member claims one ("I'll follow up"), writes
 * notes from the village's standard questions, and marks it done. The applicant never sees this page, its link, or
 * any contact or note on it.
 */
import { useState } from "react";
import { useParams } from "wouter";
import NotFound from "@/pages/NotFound";
import Layout from "@/components/Layout";
import { WORLD } from "@/components/journey/look";
import Walkthrough from "@/components/openProposal/Walkthrough";

export default function ApplicationReferences() {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");
  // Somebody who may not read the references sees "Off the trail", as production's other refused pages do (QA round 5).
  const [refused, setRefused] = useState(false);
  if (refused) return <NotFound />;
  return (
    <Layout>
      <div className={WORLD}>
        <main className="mx-auto max-w-3xl px-4 py-10" data-application-references-page="">
          <Walkthrough applicationRef={id} only="references" onRefused={() => setRefused(true)} />
        </main>
      </div>
    </Layout>
  );
}
