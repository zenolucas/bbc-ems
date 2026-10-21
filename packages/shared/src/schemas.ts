import { z } from "zod";

/** Request bodies, validated the same way by the web Server Actions, the JSON API and the app. */

export const bookSchema = z.object({
  eventId: z.string().min(1),
  items: z.array(z.object({ tierId: z.string().min(1), quantity: z.number().int().min(0).max(50) })).min(1).max(20),
});
export type BookInput = z.infer<typeof bookSchema>;

export const paySchema = z.object({
  paymentRef: z.string().trim().min(4, "Enter the reference number from your GCash/Maya receipt").max(64),
  paymentProofUrl: z.string().min(1, "Upload a screenshot of your receipt").max(500),
});
export type PayInput = z.infer<typeof paySchema>;

export const renameSchema = z.object({
  holderName: z.string().max(80),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Names must be 2 to 60 characters").max(60, "Names must be 2 to 60 characters"),
});

export const pushRegisterSchema = z.object({
  token: z.string().min(10).max(200),
  platform: z.enum(["android", "ios"]),
  deviceId: z.string().min(1).max(64),
});

export const pushUnregisterSchema = z.object({ token: z.string().min(10).max(200) });

export const localResultSchema = z.enum(["ok", "duplicate", "invalid", "void"]);

export const syncSchema = z.object({
  eventId: z.string().min(1),
  deviceId: z.string().min(1).max(64),
  checkins: z
    .array(
      z.object({
        clientId: z.string().min(8).max(64),
        ticketId: z.string().nullable(),
        rawPayload: z.string().nullable(),
        scannedAt: z.string(),
        localResult: localResultSchema.optional(),
      }),
    )
    .max(500),
});

export const undoSchema = z.object({ eventId: z.string().min(1), ticketId: z.string().min(1) });
