"use client";
import { ErrorView } from "@/components/layout/route-states";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} homeHref="/admin" />;
}
