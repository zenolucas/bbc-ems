import { Logo } from "@/components/brand/logo";
import { BottomNav } from "@/components/ui/bottom-nav";
import { getCurrentUser } from "@/lib/session";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[68px] sm:px-6">
          <Logo size={38} compactOnPhone />
          <NavLinks className="hidden sm:flex" />
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* phones get the plain sun/moon icon, the little sky switch needs room */}
            <ThemeToggle variant="icon" className="sm:hidden" />
            <ThemeToggle className="hidden sm:block" />
            <UserMenu user={user ? { name: user.name, email: user.email, role: user.role } : null} />
          </div>
        </div>
      </header>
      {/* Phones: a tab bar at the bottom on the top-level pages, so My tickets is one thumb away */}
      <BottomNav signedIn={!!user} />
    </>
  );
}
