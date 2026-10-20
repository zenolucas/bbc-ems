"use client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { inviteAction, revokeInviteAction, setRoleAction } from "@/app/admin/team-actions";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";

const select = "h-10 rounded-full border bg-card px-3.5 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-[13px]";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const ok = await runAction(() => inviteAction(email, role), { success: (r) => r.message });
          if (ok) { setEmail(""); router.refresh(); }
        });
      }}
    >
      <label htmlFor="invite-email" className="sr-only">Email</label>
      <Input id="invite-email" type="email" inputMode="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="volunteer@example.com" className="rounded-full px-4 sm:flex-1" />
      <label htmlFor="invite-role" className="sr-only">Role</label>
      <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} className={cn(select, "h-11")}>
        <option value="staff">Door crew</option>
        <option value="admin">Admin</option>
      </select>
      <Button type="submit" className="h-11 rounded-full px-5 md:h-9" disabled={pending || !email}>{pending && <Loader2 className="animate-spin" />} Give access</Button>
    </form>
  );
}

export function RoleSelect({ userId, role, name }: { userId: string; role: string; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const change = (next: string) =>
    start(async () => {
      const label = next === "member" ? "removed" : next === "admin" ? "is now an admin" : "is now door crew";
      const ok = await runAction(() => setRoleAction(userId, next), { success: `${name} ${label}` });
      if (ok) router.refresh();
    });
  return (
    <div className="flex items-center gap-2">
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
      <label htmlFor={`role-${userId}`} className="sr-only">Role for {name}</label>
      <select id={`role-${userId}`} value={role} disabled={pending} onChange={(e) => change(e.target.value)} className={select}>
        <option value="staff">Door crew</option>
        <option value="admin">Admin</option>
      </select>
      <ConfirmDialog
        title={`Remove ${name}'s access?`}
        description="They go back to being a regular member and are signed out on all devices."
        confirmLabel="Remove access"
        destructive
        onConfirm={() => change("member")}
        trigger={(open) => <Button size="sm" variant="ghost" className="rounded-full text-destructive" disabled={pending} onClick={open}>Remove</Button>}
      />
    </div>
  );
}

export function RevokeInvite({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => start(async () => { const ok = await runAction(() => revokeInviteAction(email), { success: "Invite removed" }); if (ok) router.refresh(); })}>
      {pending && <Loader2 className="animate-spin" />} Revoke
    </Button>
  );
}
