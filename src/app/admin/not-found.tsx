import { NotFoundView } from "@/components/layout/route-states";

export default function NotFound() {
  return <NotFoundView homeHref="/admin" homeLabel="Back to dashboard" />;
}
