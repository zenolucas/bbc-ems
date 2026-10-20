"use client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ProfileForm({ name, email, next, submitLabel }: { name: string; email: string; next: string; submitLabel: string }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="space-y-4 rounded-[20px] border bg-card p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await authClient.updateUser({ name: value.trim() });
        setBusy(false);
        if (error) return toast.error(error.message ?? "Could not save");
        toast.success("Saved");
        router.push(next);
        router.refresh();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="profile-email" className="text-[13px] font-semibold">Email</Label>
        <Input id="profile-email" value={email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-[13px] font-semibold">Name on tickets</Label>
        <Input id="name" value={value} onChange={(e) => setValue(e.target.value)} required minLength={2} maxLength={60} autoComplete="name" />
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
