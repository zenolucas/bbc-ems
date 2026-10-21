import { render } from "@react-email/components";
import { C, EmailLayout, MONO } from "./layout";
import { Fine, P, Title } from "./parts";

/** The mobile app's sign-in code. Night header, like the magic link. */
export function OtpEmail({ otp }: { otp: string }) {
  return (
    <EmailLayout preview={`${otp} is your sign-in code`} scene="night">
      <Title>Your sign-in code</Title>
      <P>Type this code into the Baguio Base Camp app. It works once and expires in 10 minutes.</P>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: C.ink,
          textAlign: "center",
          padding: "18px 0",
          margin: "8px 0 16px",
          borderRadius: 16,
          border: `1px dashed ${C.line}`,
        }}
      >
        {otp}
      </div>
      <Fine size={12}>Didn&apos;t ask for this? Ignore it; nobody can sign in without the code.</Fine>
    </EmailLayout>
  );
}

export async function renderOtpEmail(props: { otp: string }) {
  const el = <OtpEmail {...props} />;
  return { html: await render(el), text: await render(el, { plainText: true }) };
}
