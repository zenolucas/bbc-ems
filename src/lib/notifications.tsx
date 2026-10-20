import "server-only";
import { after } from "next/server";
import {
  BookingApprovedEmail,
  BookingCancelledEmail,
  BookingReceivedEmail,
  BookingRejectedEmail,
  BookingReservedEmail,
  EventCancelledEmail,
  renderEmail,
} from "@/emails/booking";
import { getBookingForUser } from "./bookings";
import { sendEmail } from "./email";
import { fmtDateTime, fmtRange, peso } from "./format";
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
      venueAddress: b.event.venueAddress,
      mapUrl: b.event.mapUrl,
      bookingId: b.id,
    },
  };
}

/**
 * Sends after the response is flushed, so the member isn't kept waiting on
 * email rendering. `after()` keeps the function alive on Vercel until it's done.
 */
export function notifyLater(label: string, send: () => Promise<unknown>) {
  after(async () => {
    try {
      await send();
    } catch (e) {
      console.error(`[email] ${label}`, e);
    }
  });
}

/** Awaits a send and reports whether it worked, so admin UIs can say so. */
export async function trySend(label: string, p: Promise<unknown>) {
  try {
    await p;
    return true;
  } catch (e) {
    console.error(`[email] ${label}`, e);
    return false;
  }
}

export async function notifyReserved(bookingId: string) {
  const { b, common } = await load(bookingId);
  const { html, text } = await renderEmail(
    <BookingReservedEmail
      {...common}
      totalLabel={peso(b.totalCents)}
      deadline={b.expiresAt ? fmtDateTime(b.expiresAt) : "the hold deadline"}
      gcashName={b.event.gcashName}
      gcashNumber={b.event.gcashNumber}
      hasPaymentDetails={Boolean(b.event.gcashNumber || b.event.gcashQrUrl)}
    />,
  );
  await sendEmail({ to: b.user.email, subject: `Pay ${peso(b.totalCents)} to keep your tickets · ${b.event.title}`, html, text });
}

export async function notifyPaymentSubmitted(bookingId: string) {
  const { b, common } = await load(bookingId);
  const { html, text } = await renderEmail(<BookingReceivedEmail {...common} totalLabel={peso(b.totalCents)} paymentRef={b.paymentRef ?? "—"} />);
  await sendEmail({ to: b.user.email, subject: `Receipt submitted, under review · ${b.event.title}`, html, text });
}

export async function notifyApproved(bookingId: string) {
  const { b, common } = await load(bookingId);
  const live = b.tickets.filter((t) => t.status !== "void");
  const attachments = await Promise.all(
    live.map(async (t) => ({
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
    <BookingApprovedEmail {...common} tickets={live.map((t) => ({ shortCode: t.shortCode, tier: t.tier.name, holder: t.holderName }))} />,
  );
  await sendEmail({ to: b.user.email, subject: `Your tickets · ${b.event.title}`, html, text, attachments });
}

export async function notifyRejected(bookingId: string) {
  const { b, common } = await load(bookingId);
  const { html, text } = await renderEmail(<BookingRejectedEmail {...common} note={b.reviewNote} deadline={b.expiresAt ? fmtDateTime(b.expiresAt) : null} />);
  await sendEmail({ to: b.user.email, subject: `Payment not confirmed · ${b.event.title}`, html, text });
}

export async function notifyBookingCancelled(bookingId: string, opts: { byOrganiser: boolean; reason?: string | null }) {
  const { b, common } = await load(bookingId);
  const { html, text } = await renderEmail(<BookingCancelledEmail {...common} byOrganiser={opts.byOrganiser} reason={opts.reason} />);
  await sendEmail({ to: b.user.email, subject: `Booking cancelled · ${b.event.title}`, html, text });
}

export async function notifyEventCancelled(bookingId: string, message?: string | null) {
  const { b, common } = await load(bookingId);
  const paid = b.totalCents > 0 && (b.status === "approved" || b.status === "under_review" || b.paymentProofUrl != null);
  const { html, text } = await renderEmail(<EventCancelledEmail {...common} paid={paid} message={message} />);
  await sendEmail({ to: b.user.email, subject: `Cancelled: ${b.event.title}`, html, text });
}
