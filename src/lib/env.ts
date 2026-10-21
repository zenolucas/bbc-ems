export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3100",
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  resendApiKey: process.env.RESEND_API_KEY || undefined,
  emailFrom: process.env.EMAIL_FROM ?? "Baguio Base Camp <onboarding@resend.dev>",
  blobToken: process.env.BLOB_READ_WRITE_TOKEN || undefined,
  cronSecret: process.env.CRON_SECRET ?? "",
  signingPrivateKey: process.env.TICKET_SIGNING_PRIVATE_KEY ?? "",
  signingPublicKey: process.env.TICKET_SIGNING_PUBLIC_KEY ?? "",
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  /** App-store review account: signs in with REVIEW_OTP and is never emailed. */
  reviewAccountEmail: process.env.REVIEW_ACCOUNT_EMAIL?.trim().toLowerCase() || undefined,
  reviewOtp: process.env.REVIEW_OTP?.trim() || undefined,
};

export function isAdminEmail(email: string) {
  return env.adminEmails.includes(email.toLowerCase());
}
