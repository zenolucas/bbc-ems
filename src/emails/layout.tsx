import { Body, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f6f4ec", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 32, maxWidth: 560, margin: "0 auto" }}>
          <Section style={{ textAlign: "center", marginBottom: 16 }}>
            <Img src={`${appUrl}/brand/icon-192.png`} width={64} height={64} alt="Baguio Base Camp" style={{ margin: "0 auto" }} />
            <Text style={{ color: "#1b5e3b", fontWeight: 700, fontSize: 18, margin: "8px 0 0" }}>Baguio Base Camp</Text>
          </Section>
          {children}
          <Text style={{ color: "#9db58a", fontSize: 12, textAlign: "center", marginTop: 32 }}>
            Sent by Baguio Base Camp · Baguio City
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  h1: { color: "#0b3d2e", fontSize: 22, margin: "0 0 12px" } as const,
  p: { color: "#2f4a4f", fontSize: 15, lineHeight: "22px", margin: "0 0 12px" } as const,
  button: {
    backgroundColor: "#1b5e3b",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: 10,
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
  } as const,
  muted: { color: "#5b7060", fontSize: 13 } as const,
};
