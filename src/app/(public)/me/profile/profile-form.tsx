"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await authClient.updateUser({ name: value.trim() });
        setBusy(false);
        if (error) return toast.error(error.message ?? "Could not save");
        toast.success("Saved");
        router.push("/me");
        router.refresh();
      }}
    >
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" value={value} onChange={(e) => setValue(e.target.value)} required minLength={2} maxLength={60} />
      </div>
      <Button type="submit" disabled={busy}>Save</Button>
    </form>
  );
}
