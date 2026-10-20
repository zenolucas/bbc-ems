import { asc, desc, inArray } from "drizzle-orm";
import { ScanLine, Shield } from "lucide-react";
import { db } from "@/db/client";
import { roleGrants, users } from "@/db/schema";
import { PageHeader, Panel, panelRow } from "@/components/admin/panel";
import { env } from "@/lib/env";
import { relative } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { InviteForm, RevokeInvite, RoleSelect } from "./team-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

function initialsOf(name: string, email: string) {
  const parts = (name || email.split("@")[0]).trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

export default async function TeamPage() {
  const me = await requireAdmin();
  const [team, invites] = await Promise.all([
    db.query.users.findMany({ where: inArray(users.role, ["admin", "staff"]), orderBy: [asc(users.role), asc(users.name)] }),
    db.query.roleGrants.findMany({ orderBy: desc(roleGrants.createdAt) }),
  ]);
  const admins = team.filter((u) => u.role === "admin").length;
  return (
    <div className="max-w-3xl space-y-[18px]">
      <PageHeader title="Team" sub={`${admins} admin${admins === 1 ? "" : "s"} · ${team.length - admins} door crew${invites.length ? ` · ${invites.length} waiting to sign in` : ""}`} />

      <div className="grid gap-3 sm:grid-cols-2">
        <RoleCard icon={<ScanLine className="size-5" aria-hidden />} title="Door crew" tone="ok">Open the scanner and check people in. They can&apos;t see emails, approve payments or edit events.</RoleCard>
        <RoleCard icon={<Shield className="size-5" aria-hidden />} title="Admins" tone="info">Can do everything: events, payments, the team and the ticket lab.</RoleCard>
      </div>

      <section aria-labelledby="add-h" className="rounded-[18px] border bg-card p-4 sm:p-5">
        <h2 id="add-h" className="mb-3 font-display text-lg font-extrabold">Add someone</h2>
        <InviteForm />
        <p className="mt-2.5 text-xs text-muted-foreground">They sign in at {env.appUrl.replace(/^https?:\/\//, "")}/login with this email. No separate invite email is sent, so let them know.</p>
      </section>

      {invites.length > 0 && (
        <Panel id="waiting" title="Waiting to sign in" meta={invites.length}>
          {invites.map((g) => (
            <div key={g.email} className={panelRow}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed text-xs font-bold text-muted-foreground" aria-hidden>{initialsOf("", g.email)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{g.email}</div>
                <div className="text-xs text-muted-foreground">{g.role === "admin" ? "Admin" : "Door crew"} · invited {relative(g.createdAt)}</div>
              </div>
              <RevokeInvite email={g.email} />
            </div>
          ))}
        </Panel>
      )}

      <Panel id="people" title="People with access" meta={team.length}>
        {team.map((u) => (
          <div key={u.id} className={cn(panelRow, "flex-wrap")}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold", u.role === "admin" ? "bg-primary text-primary-foreground" : "bg-success-soft text-success-foreground")} aria-hidden>{initialsOf(u.name, u.email)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{u.name || u.email}{u.id === me.id && <span className="font-normal text-muted-foreground"> (you)</span>}</div>
              <div className="truncate text-xs text-muted-foreground">{u.email}{env.adminEmails.includes(u.email.toLowerCase()) ? " · in ADMIN_EMAILS" : ""}</div>
            </div>
            {u.id === me.id ? <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted-foreground">Admin</span> : <RoleSelect userId={u.id} role={u.role} name={u.name || u.email} />}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function RoleCard({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone: "ok" | "info"; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[18px] border bg-card p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone === "ok" ? "bg-success-soft text-primary dark:text-success-foreground" : "bg-info-soft text-info-foreground")}>{icon}</span>
      <div className="min-w-0">
        <div className="font-display text-base font-extrabold">{title}</div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
