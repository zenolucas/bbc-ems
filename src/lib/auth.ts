import "server-only";
import { APIError, betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { bearer, emailOTP, magicLink, oneTimeToken } from "better-auth/plugins";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { discordLoginEnabled, env, isAdminEmail } from "./env";
import { onDiscordAccountLinked } from "./discord/link";
import { sendEmail } from "./email";
import { renderMagicLinkEmail } from "@/emails/magic-link";
import { renderOtpEmail } from "@/emails/otp";

/**
 * Sends a sign-in email, turning a provider failure into a message members can act on.
 * The real cause (e.g. Resend's test sender refusing anyone but the account owner, or an
 * unverified domain) goes to the server log, not the sign-in screen.
 */
async function sendSignInEmail(kind: string, input: Parameters<typeof sendEmail>[0]) {
  try {
    await sendEmail(input);
  } catch (e) {
    console.error(`[auth] ${kind} email to ${input.to} failed`, e);
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "We couldn't send the email just now. Check the address and try again in a minute; if it keeps failing, message the organisers.",
    });
  }
}

export const auth = betterAuth({
  baseURL: env.appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  // The mobile app's scheme, for callback URLs. Bearer calls from the app carry no cookie,
  // so better-auth's origin check doesn't apply to them.
  trustedOrigins: [env.appUrl, "bbcems://"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "member", input: false },
    },
    // Discord lets people sign up with an email they never confirmed. Making an account from one
    // would let someone claim another person's address before they ever sign in, so refuse it.
    validateUserInfo: ({ user, source }) => {
      if (source.action === "create-user" && source.oauth?.providerId === "discord" && !user.emailVerified) {
        return { error: "discord_email_unverified", errorDescription: "Verify your email in Discord first, or sign in with your email here." };
      }
    },
  },
  // "Continue with Discord" on the sign-in page and "Link Discord" on the profile page.
  // Email stays the way in for everyone; Discord is optional.
  socialProviders: discordLoginEnabled
    ? {
        discord: {
          clientId: env.discordClientId!,
          clientSecret: env.discordClientSecret!,
          // guilds.join lets the bot add them to the server once they link
          scope: ["guilds.join"],
        },
      }
    : {},
  account: {
    accountLinking: {
      enabled: true,
      // Linking from the profile page while signed in: their Discord email can be anything
      allowDifferentEmails: true,
      // Everyone can still sign in by email, so unlinking Discord never locks anyone out
      allowUnlinkingAll: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.toLowerCase();
          // ADMIN_EMAILS wins; otherwise an invite from the Team page decides the role.
          const grant = await db.query.roleGrants.findFirst({ where: eq(schema.roleGrants.email, email) });
          return {
            data: {
              ...user,
              name: user.name || email.split("@")[0],
              role: isAdminEmail(email) ? "admin" : (grant?.role ?? "member"),
            },
          };
        },
        after: async (user) => {
          // The invite has done its job once the account exists
          await db.delete(schema.roleGrants).where(eq(schema.roleGrants.email, user.email.toLowerCase()));
        },
      },
    },
    account: {
      // Linking (or signing in with) Discord: join the server and pick up their roles
      create: { after: async (account) => onDiscordAccountLinked(account) },
      update: { after: async (account) => onDiscordAccountLinked(account) },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        const { html, text } = await renderMagicLinkEmail({ url });
        await sendSignInEmail("magic link", { to: email, subject: "Your Baguio Base Camp sign-in link", html, text });
      },
    }),
    // The mobile app signs in with a 6-digit code (mail apps open links in the browser, not
    // the app) and then sends `Authorization: Bearer <token>` instead of a cookie.
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10,
      allowedAttempts: 3,
      storeOTP: "hashed",
      // Store reviewers can't read our mail: a fixed code for one review account only.
      generateOTP: ({ email }) =>
        env.reviewAccountEmail && env.reviewOtp && email.toLowerCase() === env.reviewAccountEmail ? env.reviewOtp : undefined,
      sendVerificationOTP: async ({ email, otp }) => {
        if (env.reviewAccountEmail && email.toLowerCase() === env.reviewAccountEmail) return;
        const { html, text } = await renderOtpEmail({ otp });
        await sendSignInEmail("sign-in code", { to: email, subject: `${otp} is your Baguio Base Camp code`, html, text });
      },
    }),
    bearer(),
    // Hands the app's session to its organiser WebView, see src/app/app/handoff/route.ts
    oneTimeToken({ expiresIn: 3, storeToken: "hashed" }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
