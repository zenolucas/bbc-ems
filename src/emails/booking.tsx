import { render } from "@react-email/components";
import { env } from "@/lib/env";
import { C, EmailLayout } from "./layout";
import { DetailRow, Eyebrow, Fine, Mono, Note, P, PillButton, TicketStub, Title, Where, type StubTicket, type Venue } from "./parts";

const appUrl = env.appUrl;

type Common = Venue & { eventTitle: string; bookingId: string; /** the booker's address, for the footer line */ recipient?: string };

function Footnote({ recipient }: { recipient?: string }) {
  return recipient ? <>You&apos;re getting this because you booked tickets with {recipient}.</> : null;
}

export function BookingReservedEmail(
  p: Common & { totalLabel: string; deadline: string; gcashName?: string | null; gcashNumber?: string | null; hasPaymentDetails: boolean },
) {
  return (
    <EmailLayout preview={`Pay ${p.totalLabel} by ${p.deadline} to keep your tickets for ${p.eventTitle}`} footnote={<Footnote recipient={p.recipient} />}>
      <Eyebrow color={C.warn}>On hold</Eyebrow>
      <Title>Your tickets are on hold</Title>
      <P>
        We&apos;re holding your tickets for <strong>{p.eventTitle}</strong>. Send <strong>{p.totalLabel}</strong> via GCash or Maya and upload the receipt before <strong>{p.deadline}</strong>, or the hold is released.
      </P>
      <Where {...p} />
      {p.hasPaymentDetails ? (
        <Note accent={C.grass}>
          {p.gcashName && <DetailRow label="Account name">{p.gcashName}</DetailRow>}
          {p.gcashNumber && (
            <DetailRow label="Number">
              <Mono>{p.gcashNumber}</Mono>
            </DetailRow>
          )}
          Put <Mono color={C.ink}>{p.bookingId}</Mono> in the payment message so we can match it.
        </Note>
      ) : (
        <Note>The organiser hasn&apos;t added payment details yet. We&apos;ll show them on your booking page as soon as they do.</Note>
      )}
      <PillButton href={`${appUrl}/bookings/${p.bookingId}`}>Pay and upload receipt</PillButton>
    </EmailLayout>
  );
}

export function BookingReceivedEmail(p: Common & { totalLabel: string; paymentRef: string }) {
  return (
    <EmailLayout preview={`We got your receipt for ${p.eventTitle}. An organiser will check it.`} footnote={<Footnote recipient={p.recipient} />}>
      <Eyebrow color={C.link}>Under review</Eyebrow>
      <Title>Receipt submitted, under review</Title>
      <P>
        Thanks! We have your payment details for <strong>{p.eventTitle}</strong> ({p.totalLabel}, ref <Mono>{p.paymentRef}</Mono>). An organiser checks each receipt by hand. You&apos;ll get another email with your tickets once it&apos;s confirmed.
      </P>
      <Where {...p} />
      <Note accent={C.warn}>
        <strong style={{ color: C.ink }}>Not a ticket yet.</strong> Your tickets aren&apos;t confirmed, so please don&apos;t head to the door with this email.
      </Note>
      <PillButton href={`${appUrl}/bookings/${p.bookingId}`}>View booking</PillButton>
    </EmailLayout>
  );
}

export function BookingApprovedEmail(p: Common & { tickets: StubTicket[] }) {
  const n = p.tickets.length;
  const many = n > 1;
  const first = p.tickets[0]?.holder;
  return (
    <EmailLayout preview={`Your tickets for ${p.eventTitle}`} footnote={<Footnote recipient={p.recipient} />}>
      <Eyebrow>Confirmed</Eyebrow>
      <Title>You&apos;re in.</Title>
      <P>
        Your {many ? `${n} tickets` : "ticket"} for <strong>{p.eventTitle}</strong> {many ? "are" : "is"} confirmed.{" "}
        {many ? "Show one QR per person at the door; each scans once." : "Show the QR at the door; it scans once."}
      </P>
      <Where {...p} />
      <div style={{ margin: "4px 0 6px" }}>
        {p.tickets.map((t, i) => (
          <TicketStub key={t.id} t={t} rename={many && i > 0 && t.holder === first} />
        ))}
      </div>
      <PillButton href={`${appUrl}/bookings/${p.bookingId}`}>Open my tickets</PillButton>
      <Fine>
        The QR images are attached too, so they work with no signal.
        {n === 2 && " Bringing a friend? Put their name on the second ticket from your booking page, then forward them theirs."}
        {n > 2 && " Bringing friends? Put each guest's name on their ticket from your booking page, then forward them theirs."}
      </Fine>
    </EmailLayout>
  );
}

export function BookingRejectedEmail(p: Common & { note?: string | null; deadline?: string | null }) {
  return (
    <EmailLayout preview={`We couldn't confirm your payment for ${p.eventTitle}`} footnote={<Footnote recipient={p.recipient} />}>
      <Eyebrow color={C.danger}>Payment not confirmed</Eyebrow>
      <Title>We couldn&apos;t confirm your payment</Title>
      <P>An organiser reviewed your booking for <strong>{p.eventTitle}</strong> and couldn&apos;t match the payment.</P>
      {p.note && (
        <Note accent={C.danger}>
          <strong style={{ color: C.ink }}>Note from the organiser:</strong> {p.note}
        </Note>
      )}
      <P>
        Your tickets are still on hold{p.deadline ? <> until <strong>{p.deadline}</strong></> : null}. Upload a new receipt or reference number from your booking page.
      </P>
      <PillButton href={`${appUrl}/bookings/${p.bookingId}`}>Fix my booking</PillButton>
    </EmailLayout>
  );
}

export function BookingCancelledEmail(p: Common & { reason?: string | null; byOrganiser: boolean }) {
  return (
    <EmailLayout preview={`Your booking for ${p.eventTitle} was cancelled`} footnote={<Footnote recipient={p.recipient} />}>
      <Eyebrow color={C.danger}>Cancelled</Eyebrow>
      <Title>Booking cancelled</Title>
      <P>
        {p.byOrganiser ? "The organisers cancelled" : "You cancelled"} your booking for <strong>{p.eventTitle}</strong>. Any tickets on it no longer scan at the door.
      </P>
      {p.reason && (
        <Note accent={C.danger}>
          <strong style={{ color: C.ink }}>Note from the organiser:</strong> {p.reason}
        </Note>
      )}
      {p.byOrganiser && <P>If you paid, reply to this email or message the organisers about a refund.</P>}
      <Where {...p} />
      <PillButton href={`${appUrl}/`}>Browse events</PillButton>
    </EmailLayout>
  );
}

export function EventCancelledEmail(p: Common & { paid: boolean; message?: string | null }) {
  return (
    <EmailLayout preview={`${p.eventTitle} has been cancelled`} footnote={<Footnote recipient={p.recipient} />}>
      <Eyebrow color={C.danger}>Event cancelled</Eyebrow>
      <Title>{p.eventTitle} is cancelled</Title>
      <P>We&apos;re sorry. The organisers have cancelled <strong>{p.eventTitle}</strong>, and your tickets for it are no longer valid.</P>
      {p.message && <Note accent={C.danger}>{p.message}</Note>}
      {p.paid && <P>You paid for this booking. The organisers will contact you about a refund; you can also reply to this email.</P>}
      <Where {...p} />
      <PillButton href={`${appUrl}/bookings/${p.bookingId}`}>View booking</PillButton>
    </EmailLayout>
  );
}

export async function renderEmail(el: React.ReactElement) {
  return { html: await render(el), text: await render(el, { plainText: true }) };
}
