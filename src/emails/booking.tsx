import { Button, Hr, Link, Text, render } from "@react-email/components";
import { env } from "@/lib/env";
import { EmailLayout, emailStyles as s } from "./layout";

const appUrl = env.appUrl;

type Common = { eventTitle: string; when: string; venue: string; venueAddress?: string | null; mapUrl?: string | null; bookingId: string };

const box = { ...s.p, background: "#f6f4ec", padding: 12, borderRadius: 8 } as const;

function Where(p: Common) {
  return (
    <Text style={s.muted}>
      {p.when} · {p.venue}
      {p.venueAddress ? `, ${p.venueAddress}` : ""}
      {p.mapUrl && <> · <Link href={p.mapUrl}>Map</Link></>}
    </Text>
  );
}

export function BookingReservedEmail(
  p: Common & { totalLabel: string; deadline: string; gcashName?: string | null; gcashNumber?: string | null; hasPaymentDetails: boolean },
) {
  return (
    <EmailLayout preview={`Pay ${p.totalLabel} by ${p.deadline} to keep your tickets for ${p.eventTitle}`}>
      <Text style={s.h1}>Your tickets are on hold</Text>
      <Text style={s.p}>
        We&apos;re holding your tickets for <strong>{p.eventTitle}</strong>. Send <strong>{p.totalLabel}</strong> via GCash or Maya and upload the receipt before <strong>{p.deadline}</strong>, or the hold is released.
      </Text>
      <Where {...p} />
      {p.hasPaymentDetails ? (
        <Text style={box}>
          {p.gcashName && <>Account name: {p.gcashName}<br /></>}
          {p.gcashNumber && <>Number: <span style={{ fontFamily: "monospace" }}>{p.gcashNumber}</span><br /></>}
          Put <span style={{ fontFamily: "monospace" }}>{p.bookingId}</span> in the payment message so we can match it.
        </Text>
      ) : (
        <Text style={box}>The organiser hasn&apos;t added payment details yet. We&apos;ll show them on your booking page as soon as they do.</Text>
      )}
      <Button href={`${appUrl}/bookings/${p.bookingId}`} style={s.button}>Pay and upload receipt</Button>
    </EmailLayout>
  );
}

export function BookingReceivedEmail(p: Common & { totalLabel: string; paymentRef: string }) {
  return (
    <EmailLayout preview={`We got your receipt for ${p.eventTitle}. An organiser will check it.`}>
      <Text style={s.h1}>Receipt submitted, under review</Text>
      <Text style={s.p}>
        Thanks! We have your payment details for <strong>{p.eventTitle}</strong> ({p.totalLabel}, ref {p.paymentRef}). An organiser checks each receipt by hand. You&apos;ll get another email with your tickets once it&apos;s confirmed.
      </Text>
      <Text style={s.p}>Your tickets aren&apos;t confirmed yet, so please don&apos;t head to the door with this email.</Text>
      <Where {...p} />
      <Button href={`${appUrl}/bookings/${p.bookingId}`} style={s.button}>View booking</Button>
    </EmailLayout>
  );
}

export function BookingApprovedEmail(p: Common & { tickets: { shortCode: string; tier: string; holder: string }[] }) {
  const many = p.tickets.length > 1;
  return (
    <EmailLayout preview={`Your tickets for ${p.eventTitle}`}>
      <Text style={s.h1}>You&apos;re in! 🎟️</Text>
      <Text style={s.p}>Your {many ? `${p.tickets.length} tickets are` : "ticket is"} confirmed for <strong>{p.eventTitle}</strong>.</Text>
      <Where {...p} />
      <Hr />
      {p.tickets.map((t) => (
        <Text key={t.shortCode} style={{ ...s.p, fontFamily: "monospace" }}>
          {t.shortCode} · {t.tier} · {t.holder}
        </Text>
      ))}
      <Hr />
      <Text style={s.p}>
        The QR tickets are attached and always available online. Show one QR per person at the door; each scans once.
        {many && " Bringing friends? Put each guest's name on their ticket from your booking page, then forward them theirs."}
      </Text>
      <Button href={`${appUrl}/bookings/${p.bookingId}`} style={s.button}>Open my tickets</Button>
    </EmailLayout>
  );
}

export function BookingRejectedEmail(p: Common & { note?: string | null; deadline?: string | null }) {
  return (
    <EmailLayout preview={`We couldn't confirm your payment for ${p.eventTitle}`}>
      <Text style={s.h1}>We couldn&apos;t confirm your payment</Text>
      <Text style={s.p}>An organiser reviewed your booking for <strong>{p.eventTitle}</strong> and couldn&apos;t match the payment.</Text>
      {p.note && <Text style={box}>Note from the organiser: {p.note}</Text>}
      <Text style={s.p}>
        Your tickets are still on hold{p.deadline ? <> until <strong>{p.deadline}</strong></> : null}. Upload a new receipt or reference number from your booking page.
      </Text>
      <Button href={`${appUrl}/bookings/${p.bookingId}`} style={s.button}>Fix my booking</Button>
    </EmailLayout>
  );
}

export function BookingCancelledEmail(p: Common & { reason?: string | null; byOrganiser: boolean }) {
  return (
    <EmailLayout preview={`Your booking for ${p.eventTitle} was cancelled`}>
      <Text style={s.h1}>Booking cancelled</Text>
      <Text style={s.p}>
        {p.byOrganiser ? "The organisers cancelled" : "You cancelled"} your booking for <strong>{p.eventTitle}</strong>. Any tickets on it no longer scan at the door.
      </Text>
      {p.reason && <Text style={box}>Note from the organiser: {p.reason}</Text>}
      {p.byOrganiser && <Text style={s.p}>If you paid, reply to this email or message the organisers about a refund.</Text>}
      <Where {...p} />
      <Button href={`${appUrl}/`} style={s.button}>Browse events</Button>
    </EmailLayout>
  );
}

export function EventCancelledEmail(p: Common & { paid: boolean; message?: string | null }) {
  return (
    <EmailLayout preview={`${p.eventTitle} has been cancelled`}>
      <Text style={s.h1}>{p.eventTitle} is cancelled</Text>
      <Text style={s.p}>We&apos;re sorry. The organisers have cancelled <strong>{p.eventTitle}</strong>, and your tickets for it are no longer valid.</Text>
      {p.message && <Text style={box}>{p.message}</Text>}
      {p.paid && <Text style={s.p}>You paid for this booking. The organisers will contact you about a refund; you can also reply to this email.</Text>}
      <Where {...p} />
      <Button href={`${appUrl}/bookings/${p.bookingId}`} style={s.button}>View booking</Button>
    </EmailLayout>
  );
}

export async function renderEmail(el: React.ReactElement) {
  return { html: await render(el), text: await render(el, { plainText: true }) };
}
