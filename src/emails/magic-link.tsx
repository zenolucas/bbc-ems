import { Button, Text } from "@react-email/components";
import { render } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Your sign-in link for Baguio Base Camp">
      <Text style={emailStyles.h1}>Sign in to Baguio Base Camp</Text>
      <Text style={emailStyles.p}>Tap the button below to sign in. The link works once and expires in 15 minutes.</Text>
      <Button href={url} style={emailStyles.button}>
        Sign in
      </Button>
      <Text style={{ ...emailStyles.muted, marginTop: 16 }}>
        If the button does not work, copy this link: {url}
      </Text>
      <Text style={emailStyles.muted}>If you did not request this, you can ignore this email.</Text>
    </EmailLayout>
  );
}

export async function renderMagicLinkEmail(props: { url: string }) {
  const el = <MagicLinkEmail {...props} />;
  return { html: await render(el), text: await render(el, { plainText: true }) };
}
