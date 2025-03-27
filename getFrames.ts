import ffmpeg from "fluent-ffmpeg";

export default function getFrames(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const videoStream = metadata.streams.find((s) => s.codec_type === "video");
        if (!videoStream) return reject(new Error("No video stream"));

        const frameRate: string | null = videoStream.r_frame_rate ?? null;
        const formatDuration: number | null = (() => {
          const fromVideoStream = videoStream.duration ? parseFloat(videoStream.duration) : NaN;
          if (isNaN(fromVideoStream)) return metadata.format.duration ?? null;
          return fromVideoStream;
        })();

        if (frameRate === null || formatDuration === null)
          return reject(new Error("No duration or frame rate found"));

        resolve(Math.round(formatDuration * eval(frameRate)));
      }
    });
  });
}
