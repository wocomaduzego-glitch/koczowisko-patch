import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const dynamic = "force-dynamic";
const root = path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads", "brand");
const allowed = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

async function activeImage() {
  for (const [type, ext] of Object.entries(allowed)) {
    const filename = path.join(root, `original.${ext}`);
    if ((await stat(filename).catch(() => null))?.isFile()) return { filename, type };
  }
  return null;
}

export async function GET() {
  const image = await activeImage();
  if (!image) return new Response("Nie wgrano oryginalnego obrazka", { status: 404 });
  const data = await readFile(image.filename);
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": image.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(req: Request) {
  // Pierwsze wgranie (gdy żadnego obrazka jeszcze nie ma) jest otwarte – to krok „świeżej instalacji”,
  // dzięki któremu nie trzeba najpierw zakładać konta. Zmiana już wgranego obrazka wymaga zalogowania.
  if (!(await currentUserId()) && (await activeImage()))
    return NextResponse.json({ error: "Zaloguj się, aby zmienić wgrany obrazek" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !(file.type in allowed))
      return NextResponse.json({ error: "Wybierz oryginalny obraz PNG, JPG lub WebP" }, { status: 400 });
    if (file.size < 12 || file.size > 5 * 1024 * 1024)
      return NextResponse.json({ error: "Obraz musi mieć mniej niż 5 MB" }, { status: 400 });
    const data = Buffer.from(await file.arrayBuffer());
    const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = data.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    const webp = data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    if (!((file.type === "image/png" && png) || (file.type === "image/jpeg" && jpg) || (file.type === "image/webp" && webp)))
      return NextResponse.json({ error: "Zawartość pliku nie jest poprawnym obrazem" }, { status: 400 });
    await mkdir(root, { recursive: true });
    const extension = allowed[file.type as keyof typeof allowed];
    const target = path.join(root, `original.${extension}`);
    const temporary = path.join(root, `${randomUUID()}.tmp`);
    await writeFile(temporary, data);
    await rename(temporary, target);
    // Nie przekształcamy pliku: identyczne bajty, bez kompresji ani kadrowania.
    return NextResponse.json({ ok: true, url: `/api/brand?version=${Date.now()}` });
  } catch (error) {
    console.error("[brand]", error);
    return NextResponse.json({ error: "Nie udało się zapisać obrazu" }, { status: 500 });
  }
}
