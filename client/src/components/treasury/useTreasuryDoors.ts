/**
 * WHICH TREASURY SURFACES THE SIGNED-IN MEMBER MAY OPEN, from the gate itself.
 *
 * One read of `GET /api/treasury/doors` (server/routes/treasury.ts), which asks
 * `mayAct` the same question every treasury write asks: `token.mint` for the
 * hand mint and its grants, `cash.pay` for the payout list, and `cash.pay` or
 * `moon.approve_alone` for the End of Moon review queue. The menu shows its
 * Treasury entry only on a yes, and the page draws only the sections it says.
 *
 * Kept per sign-in token, so the shell asks once per session and a different
 * member signing in on the same browser is asked afresh: their token differs.
 * A failed read is null, and null shows nothing.
 *
 * Signed out it sends nothing. The token is the caller's (`useAuth().token`),
 * so the shell's hook imports nothing beyond React.
 */
import { useEffect, useState } from "react";

export interface TreasuryDoors {
  mint: boolean;
  cashPay: boolean;
  pay: boolean;
}

export const TREASURY_DOORS_URL = "/api/treasury/doors";

const asked = new Map<string, Promise<TreasuryDoors | null>>();

/** Forget every answer, for tests and for a sign-out. */
export function forgetTreasuryDoors(): void {
  asked.clear();
}

function readDoors(token: string): Promise<TreasuryDoors | null> {
  let p = asked.get(token);
  if (!p) {
    p = fetch(TREASURY_DOORS_URL, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) return null;
        const d = await r.json();
        return { mint: d?.mint === true, cashPay: d?.cashPay === true, pay: d?.pay === true };
      })
      .catch(() => null);
    asked.set(token, p);
  }
  return p;
}

/** Whether any treasury door is open to this member. */
export function anyTreasuryDoor(d: TreasuryDoors | null | undefined): boolean {
  return !!d && (d.mint || d.cashPay || d.pay);
}

/**
 * The doors for whoever holds this sign-in token. Undefined while unknown,
 * null when the read failed or nobody is signed in.
 */
export function useTreasuryDoors(token: string | null | undefined): TreasuryDoors | null | undefined {
  const [doors, setDoors] = useState<TreasuryDoors | null | undefined>(undefined);
  useEffect(() => {
    if (!token) {
      setDoors(null);
      return;
    }
    let live = true;
    void readDoors(token).then((d) => { if (live) setDoors(d); });
    return () => { live = false; };
  }, [token]);
  return doors;
}
