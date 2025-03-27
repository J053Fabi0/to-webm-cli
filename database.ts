import { z } from "zod";
import { kvdex, collection } from "kvdex";

const kv = await Deno.openKv();

export type Deadline = "realtime" | "good" | "best";

type Params = z.infer<typeof ParamsModel>;

const ParamsModel = z.object({
  date: z.date().default(() => new Date()),
  crf: z.number(),
  deadline: z.enum(["realtime", "good", "best"]),
});

const db = kvdex({
  kv,
  schema: {
    params: collection(ParamsModel, {
      indices: {
        crf: "secondary",
        deadline: "secondary",
      },
    }),
  },
});

export default db;

if ((await db.params.count()) === 0)
  db.params.addMany([
    { crf: 50, deadline: "good" },
    { crf: 30, deadline: "best", date: new Date(Date.now() - 10) },
  ]);
