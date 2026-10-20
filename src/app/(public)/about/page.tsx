export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="prose prose-neutral mx-auto dark:prose-invert">
      <h1>About Baguio Base Camp</h1>
      <p>Baguio Base Camp is a community of friends in Baguio City that started as a Discord server. This site is where we post our events and gigs and where you can book paperless tickets.</p>
      <h2>How tickets work</h2>
      <ol>
        <li>Sign in with your email. We send you a one-time link, no password.</li>
        <li>Pick your tickets. Free tiers are confirmed instantly.</li>
        <li>For paid tiers, send payment via GCash or Maya and upload your receipt. An organiser confirms it.</li>
        <li>Your ticket QR appears under <strong>My tickets</strong> and is emailed to you. Show it at the door.</li>
      </ol>
    </div>
  );
}
