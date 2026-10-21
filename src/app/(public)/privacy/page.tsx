/*
 * DRAFT privacy policy, written from what the code does as of the mobile app
 * work (October 2026). Review before publishing or submitting the apps: add a
 * contact address, check the retention wording, and update it whenever the app
 * starts collecting something new (Play's data-safety form and Apple's privacy
 * labels must match this page).
 */
import Link from "next/link";

export const metadata = { title: "Privacy" };

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "what",
    title: "What we collect",
    body: (
      <ul>
        <li><strong>Your account:</strong> your email address and the name you put on your tickets.</li>
        <li><strong>Bookings:</strong> which tickets you booked, the total, and for paid tickets the GCash or Maya reference number and the receipt screenshot you upload.</li>
        <li><strong>Tickets:</strong> each ticket&apos;s code and the guest name on it. If you book for friends, you choose the names we store.</li>
        <li><strong>Check-ins at the door:</strong> when a ticket was scanned, which door crew account and device scanned it, and what the scanner read.</li>
        <li><strong>Signing in:</strong> a session record with your device&apos;s IP address and browser or app details, so you stay signed in.</li>
        <li><strong>The app:</strong> if you allow notifications, a push token and a device identifier so we can send booking updates to your phone.</li>
      </ul>
    ),
  },
  {
    id: "not",
    title: "What we don't do",
    body: (
      <ul>
        <li>No ads, no analytics or tracking scripts, and no selling or sharing your data for marketing.</li>
        <li>The app uses the camera only to scan tickets at the door. Nothing it sees is saved or uploaded.</li>
        <li>The app reads your photos only when you pick a receipt to upload.</li>
      </ul>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <ul>
        <li>To hold your tickets, confirm payments, and let the door crew check you in.</li>
        <li>To email you sign-in links and codes, booking updates and your tickets.</li>
        <li>To send app notifications you turned on: a booking confirmed or needing a fix, a hold about to end, an event coming up.</li>
      </ul>
    ),
  },
  {
    id: "who",
    title: "Who can see it",
    body: (
      <ul>
        <li><strong>Organisers</strong> see bookings, receipts, reference numbers, names and emails, to confirm payments and run events.</li>
        <li><strong>Door crew</strong> see the guest list for the event they&apos;re working: names, ticket codes and ticket types. It&apos;s downloaded to their phone so scanning works without signal.</li>
        <li>
          <strong>Service providers</strong> that run the site for us: Vercel (hosting and file storage for uploads), Neon (database), Resend (email) and Expo (delivering app
          notifications through Google and Apple).
        </li>
        <li>
          Receipt screenshots and event images are stored under long, random links. Anyone with the exact link can open the image, so don&apos;t share it; we never publish
          receipt links.
        </li>
      </ul>
    ),
  },
  {
    id: "phone",
    title: "On your phone",
    body: (
      <ul>
        <li>The website uses cookies only to keep you signed in (a session cookie and a short-lived copy of it), and may remember your light or dark setting in your browser.</li>
        <li>The app keeps your sign-in in your phone&apos;s secure storage and saves your tickets on the phone so they open without signal. Signing out removes them.</li>
      </ul>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <p>
        We keep your account, bookings and check-in history so organisers can answer questions about past events and payments. We don&apos;t delete records automatically yet.
        If you want your account or data removed, ask the organisers and we&apos;ll delete it, unless we need a payment record for a dispute.
      </p>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <ul>
        <li>Change the name on your account or on any ticket that hasn&apos;t been used, from your profile or the ticket itself.</li>
        <li>Turn app notifications off at any time in your phone&apos;s settings. Booking emails still arrive.</li>
        <li>Ask the organisers for a copy of your data, a correction, or deletion.</li>
      </ul>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        <p className="bbc-eyebrow text-primary">Privacy</p>
        <h1 className="text-[32px] leading-none font-extrabold sm:text-[40px]">Your data at Base Camp</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          This covers the Baguio Base Camp website and the Android and iPhone apps. We collect what it takes to sell you a ticket and let you in at the door, and nothing for
          advertising.
        </p>
      </header>

      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`privacy-${s.id}`} className="rounded-3xl border bg-card p-5 sm:p-7">
          <h2 id={`privacy-${s.id}`} className="text-xl font-extrabold sm:text-2xl">{s.title}</h2>
          <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground [&_li]:mt-2 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">{s.body}</div>
        </section>
      ))}

      <p className="text-sm text-muted-foreground">
        Questions or requests? Contact the Baguio Base Camp organisers. If this policy changes, we&apos;ll update this page. More about us on the{" "}
        <Link href="/about" className="font-semibold text-accent-foreground underline-offset-2 hover:underline">About page</Link>.
      </p>
    </div>
  );
}
