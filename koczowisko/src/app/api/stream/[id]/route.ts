import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import path from "node:path";
import { open, stat } from "node:fs/promises";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = (await db.select().from(tracks).where(eq(tracks.id, id)).limit(1))[0];
    if (!row) return new Response("Not found", { status: 404 });
    const root = path.resolve(path.join(process.cwd(), "uploads"));
    const safe = path.resolve(path.join(root, row.path));
    if (safe !== root && !safe.startsWith(root + path.sep)) return new Response("Forbidden", { status: 403 });
    const st = await stat(safe).catch(() => null);
    if (!st || !st.isFile()) return new Response("Not found", { status: 404 });
    const mime = MIME[path.extname(safe).toLowerCase()] || "application/octet-stream";

    const range = req.headers.get("range");
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      let start = m?.[1] ? parseInt(m[1], 10) : 0;
      let end = m?.[2] ? parseInt(m[2], 10) : st.size - 1;
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= st.size) end = st.size - 1;
      if (start > end) start = Math.max(0, end - 1);
      const len = end - start + 1;
      const fh = await open(safe, "r");
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, start);
      await fh.close();
      return new Response(new Uint8Array(buf), {
        status: 206,
        headers: {
          "Content-Type": mime,
          "Content-Length": String(len),
          "Content-Range": `bytes ${start}-${end}/${st.size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const fh = await open(safe, "r");
    const buf = Buffer.alloc(st.size);
    await fh.read(buf, 0, st.size, 0);
    await fh.close();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(st.size),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (e) {
    console.error("[stream]", e);
    return new Response("Internal error", { status: 500 });
  }
}
