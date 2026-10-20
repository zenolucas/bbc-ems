import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "No access", robots: { index: false } };

export default async function NoAccess() {
  const user = await getCurrentUser();
  return (
    <EmptyState
      titleAs="h1"
      title={<span className="text-xl font-extrabold">This area is for organisers</span>}
      className="mx-auto my-4 w-full max-w-md px-5 py-7 sm:my-8"
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild className="h-10 rounded-full px-[18px] text-sm font-semibold md:h-10"><Link href="/me">My tickets</Link></Button>
          <Button asChild variant="outline" className="h-10 rounded-full px-4 text-sm font-semibold md:h-10"><Link href="/">Browse events</Link></Button>
        </div>
      }
    >
      <p className="leading-normal sm:text-[15px]">
        {user ? <>You&apos;re signed in as <span className="font-medium break-all text-foreground">{user.email}</span>, which doesn&apos;t have organiser or door access. </> : null}
        If you&apos;re helping at the door, ask an organiser to add your email on the Team page, then sign in again.
      </p>
    </EmptyState>
  );
}
