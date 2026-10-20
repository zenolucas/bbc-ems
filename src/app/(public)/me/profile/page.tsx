import { requireUser } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/me/profile">) {
  const user = await requireUser("/me/profile");
  const { welcome } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{welcome ? "Welcome to Base Camp!" : "Profile"}</h1>
        <p className="text-sm text-muted-foreground">Your name is printed on your tickets, so use the one your friends know.</p>
      </div>
      <ProfileForm name={user.name} email={user.email} />
    </div>
  );
}
