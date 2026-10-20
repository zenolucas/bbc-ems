import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { SiteHeader } from "@/components/layout/site-header";
import { Notice } from "@/components/ui/notice";
import { getEventBySlug } from "@/lib/events";
import { getCurrentUser, safeNext } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

/** Explains why we're asking the visitor to sign in, based on where they were headed. */
async function intentFor(next: string): Promise<{ heading: string; sub?: string; door?: boolean }> {
  const book = next.match(/^\/events\/([^/?#]+)\/book/);
  if (book) {
    const ev = await getEventBySlug(decodeURIComponent(book[1]));
    if (ev) return { heading: `Sign in to book ${ev.title}`, sub: "You'll come straight back to pick your tickets." };
  }
  if (next.startsWith("/admin/scan")) return { heading: "Sign in to open the scanner", door: true };
  if (next.startsWith("/admin")) return { heading: "Sign in to the organiser area" };
  if (next.startsWith("/bookings")) return { heading: "Sign in to see your booking" };
  if (next.startsWith("/tickets") || next.startsWith("/me")) return { heading: "Sign in to see your tickets" };
  return { heading: "Sign in" };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = safeNext(next);
  const user = await getCurrentUser();
  if (user) redirect(nextPath);
  const intent = await intentFor(nextPath);
  const errorCode = typeof error === "string" ? error : undefined;
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col pb-12">
        <div className="bbc-skyline h-32 sm:h-48" />
        <div className="mx-auto -mt-16 w-full max-w-md px-4">
          <div className="rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
            <Logo className="mb-6" size={44} />
            <h1 className="text-2xl font-semibold tracking-tight">{intent.heading}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {intent.sub ?? "We'll email you a one-time link. No password to remember."}
            </p>
            {errorCode && (
              <Notice tone="destructive" className="mt-4" title={errorCode === "INVALID_TOKEN" ? "That link has expired or was already used" : "We couldn't sign you in"}>
                Request a fresh link below. Links work once and last 15 minutes.
              </Notice>
            )}
            {intent.door && (
              <Notice tone="info" className="mt-4" title="Open the link in Safari or Chrome">
                If your mail app opens links in its own browser, use &ldquo;Open in browser&rdquo; so the scanner stays signed in.
              </Notice>
            )}
            <LoginForm next={nextPath} />
          </div>
        </div>
      </main>
    </>
  );
}
