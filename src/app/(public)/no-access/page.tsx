import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "No access", robots: { index: false } };

export default async function NoAccess() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <Lock className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">This area is for organisers</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {user ? <>You&apos;re signed in as <span className="font-medium text-foreground">{user.email}</span>, which doesn&apos;t have organiser or door access. </> : null}
        If you&apos;re helping at the door, ask an organiser to add your email on the Team page, then sign in again.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild><Link href="/me">My tickets</Link></Button>
        <Button asChild variant="outline"><Link href="/">Browse events</Link></Button>
      </div>
    </div>
  );
}
