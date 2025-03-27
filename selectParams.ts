import { Number, Select } from "@cliffy/prompt";

type Deadline = "realtime" | "good" | "best";

export default async function selectParams(): Promise<{ crf: number; deadline: Deadline }> {
  const preset = await Select.prompt({
    message: "Elige la configuración. Menos es más calidad y peso",
    options: ["30, best", "50, good", "Otra"],
  });

  if (preset !== "Otra") {
    const [crf, deadline] = preset.split(", ") as [string, Deadline];
    return { crf: parseInt(crf), deadline };
  }

  const crf = await Number.prompt({
    message: "Selecciona el CRF, 0-63 menos es más calidad y peso",
    min: 0,
    max: 63,
  });

  const deadline = (await Select.prompt({
    message: "Selecciona el deadline",
    options: ["realtime", "good", "best"],
  })) as Deadline;

  return { crf, deadline };
}
