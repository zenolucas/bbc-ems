import "server-only";
import { expireOverdueBookings } from "./bookings";
import { sendReminders } from "./reminders";
import { notifyAllWaitlists } from "./waitlist";

/** The 15-minute sweep. Called by the Vercel cron and by "Run cron now" on the demo site. */
export async function runCronJobs() {
  const expired = await expireOverdueBookings();
  // Rides this cron rather than its own: Vercel limits how many crons a project gets.
  const reminded = await sendReminders().catch((e) => {
    console.error("[cron] reminders", e);
    return 0;
  });
  // After expiring: lapsed holds are the most common way seats free up
  const waitlisted = await notifyAllWaitlists();
  return { expired, reminded, waitlisted };
}
