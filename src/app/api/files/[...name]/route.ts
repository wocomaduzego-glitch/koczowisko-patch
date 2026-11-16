import path from "node:path";
import { readFile, stat } from "node:fs/promises";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".json": "application/json",
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string[] }> }) {
  try {
    const { name } = await params;
    const root = path.resolve(path.join(process.cwd(), "uploads"));
    const target = path.resolve(path.join(root, ...(name || [])));
    if (target !== root && !target.startsWith(root + path.sep)) return new Response("Forbidden", { status: 403 });
    const st = await stat(target).catch(() => null);
    if (!st || !st.isFile()) return new Response("Not found", { status: 404 });
    const mime = MIME[path.extname(target).toLowerCase()] || "application/octet-stream";
    const buf = await readFile(target);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[files]", e);
    return new Response("Internal error", { status: 500 });
  }
}
