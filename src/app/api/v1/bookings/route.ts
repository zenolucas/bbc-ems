import { revalidatePath } from "next/cache";
import { bookSchema } from "@bbc/shared/schemas";
import { requireApiUser } from "@/lib/api/auth";
import { bookingDTO } from "@/lib/api/dto";
import { body, handle } from "@/lib/api/respond";
import { listUserBookings } from "@/lib/bookings";
import { bookFlow } from "@/lib/flows/bookings";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  return (await listUserBookings(user.id)).map(bookingDTO);
});

/** Same as the web's bookAction: reserves the seats, issues tickets at once when free. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const input = await body(req, bookSchema);
  const result = await bookFlow(user.id, input);
  revalidatePath("/me");
  return result;
});
