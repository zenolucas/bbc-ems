import { Logo } from "@/components/brand/logo";
import { NotFoundView } from "@/components/layout/route-states";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10">
      <Logo />
      <NotFoundView />
    </main>
  );
}
