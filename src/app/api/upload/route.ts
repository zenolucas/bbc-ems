import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { storeImage } from "@/lib/storage";

const FOLDERS = new Set(["posters", "payments", "gcash"]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "");
  if (!(file instanceof File) || !FOLDERS.has(folder)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (folder !== "payments" && user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  try {
    const url = await storeImage(file, folder as "posters" | "payments" | "gcash");
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
