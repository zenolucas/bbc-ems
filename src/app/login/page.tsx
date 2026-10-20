import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";
  const user = await getCurrentUser();
  if (user) redirect(nextPath);
  return (
    <main className="flex min-h-screen flex-col">
      <div className="bbc-skyline h-40 sm:h-56" />
      <div className="mx-auto -mt-16 w-full max-w-md px-4">
        <div className="rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
          <Logo className="mb-6" size={44} />
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll email you a one-time link. No password to remember.
          </p>
          {error && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              That sign-in link has expired or was already used. Request a new one below.
            </p>
          )}
          <LoginForm next={nextPath} />
        </div>
      </div>
    </main>
  );
}
