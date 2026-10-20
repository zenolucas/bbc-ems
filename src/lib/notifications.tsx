import "server-only";
import { BookingApprovedEmail, BookingReceivedEmail, BookingRejectedEmail, renderEmail } from "@/emails/booking";
import { getBookingForUser } from "./bookings";
import { sendEmail } from "./email";
import { fmtRange, peso } from "./format";
import { renderTicketPng } from "./tickets/render/server";
import { urlFor } from "./tickets/server";

async function load(bookingId: string) {
  const b = await getBookingForUser(bookingId, "", true);
  if (!b) throw new Error("Booking not found");
  return {
    b,
    common: {
      eventTitle: b.event.title,
      when: fmtRange(b.event.startsAt, b.event.endsAt),
      venue: b.event.venueName,
      bookingId: b.id,
    },
  };
}

export async function notifyPaymentSubmitted(bookingId: string) {
  const { b, common } = await load(bookingId);
  const { html, text } = await renderEmail(<BookingReceivedEmail {...common} totalLabel={peso(b.totalCents)} ref={b.paymentRef ?? "—"} />);
  await sendEmail({ to: b.user.email, subject: `Payment received · ${b.event.title}`, html, text });
}

export async function notifyApproved(bookingId: string) {
  const { b, common } = await load(bookingId);
  const attachments = await Promise.all(
    b.tickets.map(async (t) => ({
      filename: `${t.shortCode}.png`,
      contentType: "image/png",
      content: await renderTicketPng(b.event.ticketStyle, {
        url: urlFor(t),
        shortCode: t.shortCode,
        holderName: t.holderName,
        tierName: t.tier.name,
        event: { title: b.event.title, startsAt: b.event.startsAt, endsAt: b.event.endsAt, venueName: b.event.venueName },
        theme: "light",
      }),
    })),
  );
  const { html, text } = await renderEmail(
    <BookingApprovedEmail {...common} tickets={b.tickets.map((t) => ({ shortCode: t.shortCode, tier: t.tier.name, holder: t.holderName }))} />,
  );
  await sendEmail({ to: b.user.email, subject: `Your tickets · ${b.event.title}`, html, text, attachments });
}

export async function notifyRejected(bookingId: string) {
  const { b, common } = await load(bookingId);
  const { html, text } = await renderEmail(<BookingRejectedEmail {...common} note={b.reviewNote} />);
  await sendEmail({ to: b.user.email, subject: `Payment not confirmed · ${b.event.title}`, html, text });
}
