import { z } from "zod";

/** Request bodies for /api/v1/admin. */

export const rejectSchema = z.object({
  // Same rule as rejectBooking(): the member is emailed this note, so it can't be empty
  note: z.string().trim().min(1, "Tell the member what to fix").max(1000),
});
