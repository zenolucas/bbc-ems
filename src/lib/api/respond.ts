import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError } from "@/lib/bookings";

/** Thrown inside a `handle()` callback to answer with a status and message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Wraps a /api/v1 handler: JSON out, and the errors the app can act on mapped
 * to statuses. `BookingError` messages are written for members, so they pass
 * through as-is.
 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const body = await fn(...args);
      if (body instanceof Response) return body;
      return NextResponse.json(body ?? { ok: true }, { headers: { "cache-control": "private, no-store" } });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 });
      if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Bad request" }, { status: 422 });
      console.error("[api]", e);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

/** Parses a JSON body with a shared schema; bad JSON reads as an empty object so zod reports the field. */
export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  return schema.parse(await req.json().catch(() => ({})));
}

export const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
