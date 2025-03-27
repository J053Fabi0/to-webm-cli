import ffmpeg from "fluent-ffmpeg";
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

const video = await Select.prompt({
  message: "¿Cuál video quieres comprimir?",
  options: [...videos, "Salir"],
});
if (video === "Salir") Deno.exit();

const { crf, deadline } = await selectParams();

const outputFile = join(Deno.cwd(), `${parse(video).name}.webm`);
const videoPath = join(Deno.cwd(), video);

const pids = new Set<number>();
let ranKill = false;
function killCommands() {
  if (ranKill) return;
  ranKill = true;
  const promise = Deno.remove(join(Deno.cwd(), "ffmpeg2pass-0.log")).catch(() => undefined);

  console.log(pids);
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
}
setHandler(killCommands);

try {
  console.log("Comenzando la primera fase");

  await new Promise<void>((resolve, reject) => {
    const p = progress("First pass  |  [[bar]]  |  [[count]]/[[total]]  [[rate]]  [[eta]]", { total: 100 });

    const command = ffmpeg(videoPath);

    command
      .videoCodec("libvpx-vp9")
      .outputOptions(["-an", "-b:v 0", "-pass 1", "-f null", "-row-mt 1", `-crf ${crf}`, `-deadline ${deadline}`])
      .output("/dev/null")
      .on("start", () => pids.add((command.ffmpegProc as unknown as { pid: number }).pid))
      .on("end", () => {
        resolve();
      })
      .on("progress", () => p.next())
      .on("error", (e) => {
        p.error();
        reject(e);
      })
      .run();
  });

  console.log("Comenzando la segunda fase");

  await new Promise<void>((resolve, reject) => {
    const p = progress("Second pass  |  [[bar]]  |  [[count]]/[[total]]  [[rate]]  [[eta]]", { total: 100 });
    let lastPercent = 0;

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
      .on("start", () => pids.add((command.ffmpegProc as unknown as { pid: number }).pid))
      .on("end", () => resolve())
      .on("progress", (progress) => {
        if (progress.percent && isNaN(progress.percent) === false && progress.percent > lastPercent) {
          p.update(parseInt((progress.percent * 100).toString()) / 100);
          lastPercent = progress.percent;
        }
      })
      .on("error", (e) => {
        p.error();
        reject(e);
      })
      .run();
  });
} catch (e) {
  await new Promise((r) => setTimeout(r, 100));
  if (ranKill === false) console.error(e);
} finally {
  await new Promise((r) => setTimeout(r, 100));
  if (ranKill === false) console.log(`Terminado. ${crf}, ${deadline}`);
  killCommands();
}
