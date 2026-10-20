import { NotFoundView } from "@/components/layout/route-states";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/** Unmatched URLs land outside every route group, so this brings its own header and footer. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        <NotFoundView />
      </main>
      <SiteFooter />
    </>
  );
}
