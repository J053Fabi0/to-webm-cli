import db, { Deadline } from "./database.ts";
import { colors } from "@cliffy/ansi/colors";
import { BetterMap } from "@retraigo/bettermap";
import { Number, Select } from "@cliffy/prompt";

const maxHistory = 10;

export default async function selectParams(): Promise<{ crf: number; deadline: Deadline }> {
  const params = (await db.params.getMany()).result
    .sort((a, b) => b.value.date.valueOf() - a.value.date.valueOf())
    .slice(0, maxHistory);

  const paramsMap = new BetterMap<string, (typeof params)[number]>();
  for (const p of params) paramsMap.set(`${p.value.crf}, ${p.value.deadline}`, p);

  console.log();
  const key = await Select.prompt({
    message: `Elige la configuración. ${colors.italic("Menos")} da mayor calidad y tamaño`,
    options: [...paramsMap.keys(), "Otra"],
  });

  if (key !== "Otra") {
    const selected = paramsMap.get(key)!;
    await db.params.update(selected.id, { date: new Date() });
    return { crf: selected.value.crf, deadline: selected.value.deadline };
  }

  console.log();
  const crf = await Number.prompt({
    message: "Selecciona el CRF, 0-63 menos es más calidad y peso",
    min: 0,
    max: 63,
  });

  console.log();
  const deadline = (await Select.prompt({
    message: "Selecciona el deadline",
    options: ["realtime", "good", "best"],
  })) as Deadline;

  const existingHistory = await db.params.findBySecondaryIndex("deadline", deadline, {
    filter: (p) => p.value.crf === crf,
  });

  if (existingHistory.result.at(0)) await db.params.update(existingHistory.result[0].id, { date: new Date() });
  else await db.params.add({ crf, deadline });

  return { crf, deadline };
}
