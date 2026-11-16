import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return NextResponse.json({ error: "Dozwolone: PNG, JPEG, WebP" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Plik za duży (max 5 MB)" }, { status: 400 });
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const id = randomUUID();
    const dir = path.join(process.cwd(), "uploads", "covers");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${id}.${ext}`), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url: `/api/files/covers/${id}.${ext}` });
  } catch (e) {
    console.error("[upload-image]", e);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
