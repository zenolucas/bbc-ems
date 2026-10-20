import { requireUser, safeNext } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/me/profile">) {
  const user = await requireUser("/me/profile");
  const { welcome, next } = await searchParams;
  const nextPath = safeNext(next, "/me");
  const continuing = nextPath !== "/me" && nextPath !== "/";
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="space-y-1.5">
        <p className="bbc-eyebrow text-primary">{welcome ? "One quick thing" : "Your account"}</p>
        <h1 className="text-[30px] leading-none font-extrabold tracking-tight">{welcome ? "Welcome to Base Camp!" : "Profile"}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {welcome
            ? "What name should go on your tickets? Use the one the door crew will recognise."
            : "This name goes on new tickets. Tickets you already have keep their names; rename those from the booking page."}
        </p>
      </div>
      <ProfileForm name={user.name} email={user.email} next={nextPath} submitLabel={welcome && continuing ? "Save and continue" : "Save"} />
    </div>
  );
}
