import { asc, desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { roleGrants, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { relative } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { InviteForm, RevokeInvite, RoleSelect } from "./team-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const [team, invites] = await Promise.all([
    db.query.users.findMany({ where: inArray(users.role, ["admin", "staff"]), orderBy: [asc(users.role), asc(users.name)] }),
    db.query.roleGrants.findMany({ orderBy: desc(roleGrants.createdAt) }),
  ]);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Door crew</span> can open the scanner and check people in. They can&apos;t see emails, approve payments or edit events.{" "}
          <span className="font-medium text-foreground">Admins</span> can do everything.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add someone</CardTitle></CardHeader>
        <CardContent>
          <InviteForm />
          <p className="mt-2 text-xs text-muted-foreground">They sign in at {env.appUrl.replace(/^https?:\/\//, "")}/login with this email. No separate invite email is sent, so let them know.</p>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Waiting to sign in</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {invites.map((g) => (
              <div key={g.email} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{g.email}</div>
                  <div className="text-muted-foreground">{g.role === "admin" ? "Admin" : "Door crew"} · invited {relative(g.createdAt)}</div>
                </div>
                <RevokeInvite email={g.email} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>People with access</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {team.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.name || u.email}{u.id === me.id && <span className="text-muted-foreground"> (you)</span>}</div>
                <div className="truncate text-muted-foreground">{u.email}{env.adminEmails.includes(u.email.toLowerCase()) ? " · in ADMIN_EMAILS" : ""}</div>
              </div>
              {u.id === me.id ? <span className="text-muted-foreground">Admin</span> : <RoleSelect userId={u.id} role={u.role} name={u.name || u.email} />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
