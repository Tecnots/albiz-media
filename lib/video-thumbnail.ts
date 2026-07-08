import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { mkdtemp, writeFile, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

function extractFrame(inputPath: string, outputPath: string, seekSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath);
    if (seekSeconds > 0) cmd.seekInput(seekSeconds);
    cmd
      // The `thumbnail` filter scans the next N frames from the seek point and
      // picks the most representative one, skipping black/blank frames —
      // covers the "first non-black frame" requirement without hand-rolled
      // frame analysis.
      .outputOptions(["-vf", "thumbnail=30,scale=720:-2", "-frames:v", "1", "-q:v", "3"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

async function hasNonEmptyFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

// Extracts a representative frame from a video buffer as a JPEG buffer.
// Seeks ~1s in first (covers the "1-3 seconds in" preference); if that fails
// or silently produces nothing — seeking past a clip shorter than 1s doesn't
// always raise an ffmpeg error, it can just emit zero frames — retries from
// the very start so short clips still get a thumbnail instead of none at all.
export async function generateVideoThumbnail(videoBuffer: Buffer, ext: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "short-thumb-"));
  const inputPath = join(dir, `input.${ext || "mp4"}`);
  const outputPath = join(dir, "thumb.jpg");

  try {
    await writeFile(inputPath, videoBuffer);

    try {
      await extractFrame(inputPath, outputPath, 1);
      if (!(await hasNonEmptyFile(outputPath))) throw new Error("no frame produced");
    } catch {
      await extractFrame(inputPath, outputPath, 0);
      if (!(await hasNonEmptyFile(outputPath))) throw new Error("thumbnail extraction produced no output");
    }

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
