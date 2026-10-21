import { render } from "@react-email/components";
import { env } from "@/lib/env";
import { C, EmailLayout } from "./layout";
import { Eyebrow, Fine, P, PillButton, Title, Where, type Venue } from "./parts";

/** Sent to everyone on an event's waitlist when seats free up. First to book gets them. */
export function SeatsOpenEmail(p: Venue & { eventTitle: string; slug: string; left: number; recipient: string }) {
  return (
    <EmailLayout
      preview={`Tickets just opened up for ${p.eventTitle}`}
      footnote={<>You&apos;re getting this because you asked to hear about {p.eventTitle} with {p.recipient}.</>}
    >
      <Eyebrow color={C.grass}>Tickets available</Eyebrow>
      <Title>Seats just opened up</Title>
      <P>
        {p.left === 1 ? "A ticket" : `${p.left} tickets`} for <strong>{p.eventTitle}</strong> just came back. Everyone on the waitlist hears at the same
        time, so book soon if you still want to go.
      </P>
      <Where {...p} />
      <PillButton href={`${env.appUrl}/events/${p.slug}`} large>
        Get tickets
      </PillButton>
      <Fine size={12}>Missed out? Tap &ldquo;Notify me&rdquo; on the event page again and we&apos;ll tell you if more open up.</Fine>
    </EmailLayout>
  );
}

export async function renderSeatsOpenEmail(props: Parameters<typeof SeatsOpenEmail>[0]) {
  const el = <SeatsOpenEmail {...props} />;
  return { html: await render(el), text: await render(el, { plainText: true }) };
}
