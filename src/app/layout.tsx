import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { DemoBar } from "@/components/demo/demo-bar";
import { Toaster } from "@/components/ui/sonner";
import { DEMO_ENV } from "@/lib/demo/flag";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display face for headlines, big numbers and ticket codes. The optical-size axis
// keeps it friendly at 12px and punchy at 56px; Geist stays for everything else.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["opsz"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"),
  title: { default: "Baguio Base Camp", template: "%s · Baguio Base Camp" },
  description: "Events, gigs and paperless tickets for the Baguio Base Camp community.",
  icons: { icon: "/brand/icon-64.png", apple: "/brand/icon-180.png" },
  manifest: "/manifest.webmanifest",
  // The demo deployment must never be mistaken for the real site in search results
  robots: DEMO_ENV ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1c20" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col has-[[data-sticky-cta]]:pb-20 lg:has-[[data-sticky-cta]]:pb-0 has-[[data-bottom-nav]]:pb-20 sm:has-[[data-bottom-nav]]:pb-0">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {DEMO_ENV && <DemoBar />}
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
