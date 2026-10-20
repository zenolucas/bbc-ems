import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Logo size={28} />
        <p>Baguio Base Camp · events, gigs and paperless tickets · Baguio City</p>
      </div>
    </footer>
  );
}
