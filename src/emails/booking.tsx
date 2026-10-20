import { Button, Hr, Text, render } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type Common = { eventTitle: string; when: string; venue: string; bookingId: string };

export function BookingReceivedEmail(p: Common & { totalLabel: string; ref: string }) {
  return (
    <EmailLayout preview={`We got your payment details for ${p.eventTitle}`}>
      <Text style={s.h1}>Payment received, pending review</Text>
      <Text style={s.p}>Thanks! We&apos;ve logged your payment for <strong>{p.eventTitle}</strong> ({p.totalLabel}, ref {p.ref}). An organiser will confirm it shortly and your tickets will appear under My tickets.</Text>
      <Text style={s.muted}>{p.when} · {p.venue}</Text>
      <Button href={`${appUrl}/bookings/${p.bookingId}`} style={s.button}>View booking</Button>
    </EmailLayout>
  );
}

export function BookingApprovedEmail(p: Common & { tickets: { shortCode: string; tier: string; holder: string }[] }) {
  return (
    <EmailLayout preview={`Your tickets for ${p.eventTitle}`}>
      <Text style={s.h1}>You&apos;re in! 🎟️</Text>
      <Text style={s.p}>Your {p.tickets.length === 1 ? "ticket is" : `${p.tickets.length} tickets are`} confirmed for <strong>{p.eventTitle}</strong>.</Text>
      <Text style={s.muted}>{p.when} · {p.venue}</Text>
      <Hr />
      {p.tickets.map((t) => (
        <Text key={t.shortCode} style={{ ...s.p, fontFamily: "monospace" }}>
          {t.shortCode} · {t.tier} · {t.holder}
        </Text>
      ))}
      <Hr />
      <Text style={s.p}>The QR tickets are attached as images and always available online. Show one QR per person at the door; each scans once.</Text>
      <Button href={`${appUrl}/me`} style={s.button}>Open my tickets</Button>
    </EmailLayout>
  );
}

export function BookingRejectedEmail(p: Common & { note?: string | null }) {
  return (
    <EmailLayout preview={`We couldn't confirm your payment for ${p.eventTitle}`}>
      <Text style={s.h1}>We couldn&apos;t confirm your payment</Text>
      <Text style={s.p}>An organiser reviewed your booking for <strong>{p.eventTitle}</strong> and couldn&apos;t match the payment.</Text>
      {p.note && <Text style={{ ...s.p, background: "#f6f4ec", padding: 12, borderRadius: 8 }}>Note from the organiser: {p.note}</Text>}
      <Text style={s.p}>You can upload a new receipt or reference number from your booking page.</Text>
      <Button href={`${appUrl}/bookings/${p.bookingId}`} style={s.button}>Fix my booking</Button>
    </EmailLayout>
  );
}

export async function renderEmail(el: React.ReactElement) {
  return { html: await render(el), text: await render(el, { plainText: true }) };
}
