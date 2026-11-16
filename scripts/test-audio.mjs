import { spawnSync } from "node:child_process";

// Original synthetic test tone only. No third-party or copyrighted recordings.
export function audioFixtures(seconds = 12) {
  const rate = 22050, n = seconds * rate, buffer = Buffer.alloc(44 + n * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buffer.writeInt16LE(Math.round(Math.sin(i / rate * 440 * Math.PI * 2) * 1000), 44 + i * 2);
  const fixtures = [{ name: "test.wav", mimeType: "audio/wav", buffer }];
  for (const [format, codec, mime] of [["mp3", "libmp3lame", "audio/mpeg"], ["ogg", "libvorbis", "audio/ogg"]]) {
    const encoded = spawnSync(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-c:a", codec, "-f", format, "pipe:1"], { input: buffer, maxBuffer: 16 * 1024 * 1024 });
    if (encoded.status !== 0) {
      if (process.argv.includes("--all-formats")) throw new Error(`FFmpeg is needed for real ${format} tests; set FFMPEG_PATH if necessary.`);
      console.log(`SKIP ${format}: install FFmpeg for real codec tests.`);
    } else fixtures.push({ name: `test.${format}`, mimeType: mime, buffer: encoded.stdout });
  }
  return fixtures;
}
