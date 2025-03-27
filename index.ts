import ffmpeg from "fluent-ffmpeg";
import getFrames from "./getFrames.ts";
import { join, parse } from "@std/path";
import { Select } from "@cliffy/prompt";
import { progress } from "@ryweal/progress";
import { fileTypeFromFile } from "file-type";
import selectParams from "./selectParams.ts";
import { setHandler } from "https://deno.land/x/ctrlc@0.2.1/mod.ts";

const videos: string[] = [];
for await (const file of Deno.readDir(Deno.cwd())) {
  if (file.isFile === false) continue;

  if (file.name.endsWith(".webm")) continue;
  const mime = await fileTypeFromFile(join(Deno.cwd(), file.name));
  if (mime === undefined || mime.mime.startsWith("video/") === false) continue;

  videos.push(file.name);
}

if (videos.length === 0) {
  console.log(`No hay videos en ${Deno.cwd()}`);
  Deno.exit();
}

const video = await Select.prompt({ message: "¿Cuál video quieres comprimir?", options: [...videos, "Salir"] });
if (video === "Salir") Deno.exit();

const { crf, deadline } = await selectParams();

const outputFile = join(Deno.cwd(), `${parse(video).name}.webm`);
const videoPath = join(Deno.cwd(), video);

const pids = new Set<number>();
let ranKill = false;
function end(kill: boolean) {
  if (ranKill) return;
  ranKill = true;
  const promise = Deno.remove(join(Deno.cwd(), "ffmpeg2pass-0.log")).catch(() => undefined);

  if (kill) {
    for (let i = 0; i < 10; i++)
      for (const pid of pids) {
        try {
          Deno.kill(pid, "SIGINT");
        } catch {
          //
        }
      }

    console.log("Closing in 3 secs");
    setTimeout(async () => {
      await promise;
      Deno.exit();
    }, 3000);
  } else {
    Deno.exit();
  }
}
setHandler(() => end(true));

try {
  console.log("\nComenzando la primera fase");

  await new Promise<void>((resolve, reject) => {
    const p = progress("First pass  |  [[bar]]  |  [[count]]/[[total]]  [[rate]]  eta: [[eta]]", { total: 100 });

    const command = ffmpeg(videoPath);

    command
      .videoCodec("libvpx-vp9")
      .outputOptions(["-an", "-b:v 0", "-pass 1", "-f null", "-row-mt 1", `-crf ${crf}`, `-deadline ${deadline}`])
      .output("/dev/null")
      .on("start", () => pids.add((command as unknown as { ffmpegProc: { pid: number } }).ffmpegProc.pid))
      .on("end", () => {
        if (ranKill === false) p.update(100);
        resolve();
      })
      .on("progress", () => {
        if (ranKill) return;
        p.next();
      })
      .on("error", reject)
      .run();
  });

  console.log("\nComenzando la segunda fase");

  const frames = await getFrames(videoPath);

  await new Promise<void>((resolve, reject) => {
    const p = progress("Second pass  |  [[bar]]  |  [[count]]/[[total]]  [[rate]]  [[eta]]", { total: frames });
    let lastFrames = 0;

    const command = ffmpeg(videoPath);

    command
      .videoCodec("libvpx-vp9")
      .audioCodec("libopus")
      .outputOptions([
        "-b:v 0",
        `-crf ${crf}`,
        "-pass 2",
        `-deadline ${deadline}`,
        "-row-mt 1",
        "-b:a 96k",
        "-ac 2",
      ])
      .save(outputFile)
      .on("start", () => pids.add((command as unknown as { ffmpegProc: { pid: number } }).ffmpegProc.pid))
      .on("end", () => {
        if (ranKill === false) p.update(frames);
        resolve();
      })
      .on("progress", (progress) => {
        if (
          progress.frames &&
          isNaN(progress.frames) === false &&
          progress.frames > lastFrames &&
          ranKill === false
        ) {
          p.update(progress.frames);
          lastFrames = progress.frames;
        }
      })
      .on("error", reject)
      .run();
  });
} catch (e) {
  await new Promise((r) => setTimeout(r, 100));
  if (ranKill === false) console.error(e);
} finally {
  await new Promise((r) => setTimeout(r, 100));
  if (ranKill === false) {
    console.log(`\nTerminado. ${crf}, ${deadline}`);
    end(false);
  }
}
