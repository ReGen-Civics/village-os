/**
 * /pricing: the Treasurer's pricing desk, as a page of its own (quest re-price
 * Q3). Whoever holds the pay-setting power opens it here, admin or not; the
 * server refuses everyone else (`GET /api/quests/pricing-desk`, role.pay).
 */
import { useCallback } from "react";
import Layout from "@/components/Layout";
import PricingDesk from "@/components/valuation/PricingDesk";
import { gameFetch } from "@/lib/gameApi";
import { useAuth } from "@/contexts/AuthContext";

const REFUSED = "The pricing desk is for whoever holds the pay-setting power, such as the Treasurer.";

export default function PricingDeskPage() {
  const { token } = useAuth() as { token?: string | null };
  const call = useCallback(async (path: string, body?: unknown, method = "POST") => {
    // Signed out, the server can only refuse, so the desk asks nothing (QA P1-16: a 401 in the console).
    if (!token) return { error: REFUSED };
    const r = await gameFetch(`/api${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) return { error: REFUSED };
    return data;
  }, [token]);
  return (
    <Layout>
      <section className="py-8 px-4">
        <PricingDesk call={call} />
      </section>
    </Layout>
  );
}
