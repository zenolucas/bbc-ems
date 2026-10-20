import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Pages that paint edge to edge (the home hero, the event poster on phones) mark themselves `data-bleed` and bring their own container */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 has-[[data-bleed]]:max-w-none has-[[data-bleed]]:px-0 has-[[data-bleed]]:pt-0">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
