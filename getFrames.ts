import ffmpeg from "fluent-ffmpeg";

export default function getFrames(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const videoStream = metadata.streams.find((s) => s.codec_type === "video");
        if (!videoStream) return reject(new Error("No video stream"));

        const frameRate = videoStream.r_frame_rate;
        const formatDuration = videoStream.duration ?? metadata.format.duration;

        if (frameRate === undefined || formatDuration === undefined)
          return reject(new Error("No duration or frame rate found"));

        const formatDurationParsed =
          typeof formatDuration === "string" ? parseFloat(formatDuration) : formatDuration;

        resolve(Math.round(formatDurationParsed * eval(frameRate)));
      }
    });
  });
}
