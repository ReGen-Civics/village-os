/**
 * `GET /api/profile` READ AS A PLAIN MEMBER.
 *
 * The live view for QA marks every read it serves to be answered as a plain member
 * (server/lib/liveView.ts, server/lib/readAsMember.ts). The profile used to keep the
 * holder's real role, so the client drew admin and founder surfaces (the /roles waitlist
 * panel, the Command Centre, launch and network admin reads) and the server then refused
 * each of their reads. Driven through the real handler with plain request objects; no
 * database is needed.
 */
import { describe, expect, it } from "vitest";
import { asPlainMember, register } from "./profile";
import { asPlainMemberHeaders } from "../lib/readAsMember";

function getProfileAs(user: Record<string, unknown>, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  let get: ((req: any, res: any) => Promise<unknown>) | undefined;
  const app = {
    get: (p: string, h: any) => { if (p === "/api/profile") get = h; },
    post: () => undefined,
    put: () => undefined,
  } as any;
  register(app, {
    authedUser: (async () => user) as any,
    members: {} as any,
    publicUser: (u: any) => ({ ...u, adminAccess: u.role === "admin" || u.role === "founder" }),
    getPool: (() => null) as any,
  });
  return new Promise((resolve) => {
    const res: any = {
      statusCode: 200,
      status(c: number) { this.statusCode = c; return this; },
      json(b: unknown) { resolve({ status: this.statusCode, body: b }); return this; },
    };
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    void get!({ headers: lower, get: (n: string) => lower[n.toLowerCase()] }, res);
  });
}

describe("GET /api/profile, read as a plain member", () => {
  it("answers a founder or an admin as a member, with no admin access, when the read is marked", async () => {
    for (const role of ["founder", "admin"]) {
      const r = await getProfileAs({ id: "u1", name: "Holder", role }, asPlainMemberHeaders());
      expect([r.status, r.body.role, r.body.adminAccess, r.body.name]).toEqual([200, "member", false, "Holder"]);
    }
  });

  it("answers the holder's real role when the read is not marked", async () => {
    const r = await getProfileAs({ id: "u1", name: "Holder", role: "founder" });
    expect([r.body.role, r.body.adminAccess]).toEqual(["founder", true]);
  });

  it("leaves any other role as it is", () => {
    expect(asPlainMember({ role: "member", adminAccess: false })).toEqual({ role: "member", adminAccess: false });
    expect(asPlainMember({ role: "visitor", adminAccess: true })).toEqual({ role: "visitor", adminAccess: false });
    expect(asPlainMember(null)).toBeNull();
  });
});
