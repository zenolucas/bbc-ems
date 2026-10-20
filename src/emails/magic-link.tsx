import { render } from "@react-email/components";
import { C, EmailLayout, MONO } from "./layout";
import { Fine, Note, P, PillButton, Title } from "./parts";

/** One job, one button. Night header, so it doesn't read like a booking email. */
export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Your sign-in link for Baguio Base Camp" scene="night">
      <Title>Sign in</Title>
      <P>Tap the button to sign in to Baguio Base Camp. The link works once and expires in 15 minutes.</P>
      <PillButton href={url} large>
        Sign in to Base Camp
      </PillButton>
      <Note>
        <strong style={{ color: C.ink }}>Door crew on a phone?</strong> Open this in Safari or Chrome rather than inside your mail app, so the scanner stays signed in.
      </Note>
      <Fine size={12}>
        Button not working? Copy this link: <span style={{ fontFamily: MONO, color: C.link, wordBreak: "break-all" }}>{url}</span>
      </Fine>
      <Fine size={12}>Didn&apos;t ask for this? Ignore it; nothing happens unless the link is opened.</Fine>
    </EmailLayout>
  );
}

export async function renderMagicLinkEmail(props: { url: string }) {
  const el = <MagicLinkEmail {...props} />;
  return { html: await render(el), text: await render(el, { plainText: true }) };
}
