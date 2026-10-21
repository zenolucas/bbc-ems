import "server-only";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { bearer, emailOTP, magicLink, oneTimeToken } from "better-auth/plugins";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env, isAdminEmail } from "./env";
import { sendEmail } from "./email";
import { renderMagicLinkEmail } from "@/emails/magic-link";
import { renderOtpEmail } from "@/emails/otp";

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
        await sendEmail({ to: email, subject: "Your Baguio Base Camp sign-in link", html, text });
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
        await sendEmail({ to: email, subject: `${otp} is your Baguio Base Camp code`, html, text });
      },
    }),
    bearer(),
    // Hands the app's session to its organiser WebView, see src/app/app/handoff/route.ts
    oneTimeToken({ expiresIn: 3, storeToken: "hashed" }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
