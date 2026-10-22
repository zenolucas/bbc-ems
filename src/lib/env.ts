/** Feature flag for the whole Discord integration. Off unless set to 1. */
export const discordEnabled = process.env.DISCORD_ENABLED === "1";

function discordVar(name: string) {
  return discordEnabled ? process.env[name]?.trim() || undefined : undefined;
}

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
  /**
   * Discord application (OAuth sign-in) and bot (announcements, roles). All optional, and all
   * ignored unless DISCORD_ENABLED=1: the integration ships switched off.
   */
  discordClientId: discordVar("DISCORD_CLIENT_ID"),
  discordClientSecret: discordVar("DISCORD_CLIENT_SECRET"),
  discordBotToken: discordVar("DISCORD_BOT_TOKEN"),
  discordGuildId: discordVar("DISCORD_GUILD_ID"),
  discordInviteUrl: discordVar("DISCORD_INVITE_URL"),
};

/** Members can sign in with / link Discord. */
export const discordLoginEnabled = Boolean(env.discordClientId && env.discordClientSecret);
/** The bot can act on the server: announcements, roles, chats. */
export const discordBotEnabled = Boolean(env.discordBotToken && env.discordGuildId);

export function isAdminEmail(email: string) {
  return env.adminEmails.includes(email.toLowerCase());
}
