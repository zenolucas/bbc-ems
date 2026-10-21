import type { BookingDTO, BookingStatus, EventDetailDTO, EventsDTO, TicketDTO } from "@bbc/shared/api-types";
import type { BookInput, PayInput } from "@bbc/shared/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { API_URL } from "./config";
import { useSession } from "./session";
import { refreshTickets, upsertTicket } from "./tickets-cache";

/** Uploads and posters may be stored as site-relative paths (/uploads/…) in development. */
export function assetUrl(u: string | null | undefined) {
  if (!u) return null;
  return u.startsWith("/") ? API_URL + u : u;
}

export const keys = {
  events: ["events"] as const,
  event: (slug: string) => ["event", slug] as const,
  bookings: ["bookings"] as const,
  booking: (id: string) => ["booking", id] as const,
};

export function useEvents() {
  return useQuery({ queryKey: keys.events, queryFn: () => api<EventsDTO>("/api/v1/events") });
}

export function useEvent(slug: string) {
  const { status } = useSession();
  // Signed-in and signed-out answers differ (myBooking), so the session is part of the key
  return useQuery({ queryKey: [...keys.event(slug), status], queryFn: () => api<EventDetailDTO>(`/api/v1/events/${encodeURIComponent(slug)}`) });
}

export function useBookings() {
  const { status } = useSession();
  return useQuery({ queryKey: keys.bookings, queryFn: () => api<BookingDTO[]>("/api/v1/bookings"), enabled: status === "signedIn" });
}

export function useBooking(id: string) {
  return useQuery({ queryKey: keys.booking(id), queryFn: () => api<BookingDTO>(`/api/v1/bookings/${encodeURIComponent(id)}`) });
}

/** After any booking change: lists, the event's "your booking" banner, and the wallet. */
function useInvalidateBookings() {
  const qc = useQueryClient();
  return (bookingId?: string) => {
    qc.invalidateQueries({ queryKey: keys.bookings });
    qc.invalidateQueries({ queryKey: ["event"] });
    qc.invalidateQueries({ queryKey: keys.events });
    if (bookingId) qc.invalidateQueries({ queryKey: keys.booking(bookingId) });
    refreshTickets().catch(() => {});
  };
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: BookInput) => api<{ id: string; free: boolean }>("/api/v1/bookings", { body: input }),
    onSuccess: (r) => invalidate(r.id),
  });
}

export function useCancelBooking(id: string) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: () => api(`/api/v1/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
    onSuccess: () => invalidate(id),
  });
}

export function useSubmitPayment(id: string) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: PayInput) => api(`/api/v1/bookings/${encodeURIComponent(id)}/payment`, { body: input }),
    onSuccess: () => invalidate(id),
  });
}

export function useRenameTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (holderName: string) => api<TicketDTO>(`/api/v1/tickets/${encodeURIComponent(ticketId)}`, { method: "PATCH", body: { holderName } }),
    onSuccess: (t) => {
      upsertTicket(t).catch(() => {});
      qc.invalidateQueries({ queryKey: keys.booking(t.bookingId) });
    },
  });
}

/** Member-facing status names, same as the web's status badge. */
export const statusLabel: Record<BookingStatus | "valid" | "used" | "void", string> = {
  pending_payment: "Awaiting payment",
  under_review: "Being reviewed",
  approved: "Confirmed",
  rejected: "Payment not accepted",
  expired: "Expired",
  cancelled: "Cancelled",
  valid: "Valid",
  used: "Checked in",
  void: "Voided",
};

export const statusTone: Record<BookingStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending_payment: "warning",
  under_review: "info",
  approved: "success",
  rejected: "danger",
  expired: "neutral",
  cancelled: "neutral",
};
