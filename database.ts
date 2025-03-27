import { z } from "zod";
import { kvdex, collection } from "kvdex";
import { join } from "@std/path/join";

Deno.mkdir(join(Deno.env.get("HOME")!, ".local/share/toWebm"), { recursive: true }).catch(() => 1);
const path = join(Deno.env.get("HOME")!, ".local/share/toWebm/toWebmDb.sqlite3");
const kv = await (async () => {
  try {
    return await Deno.openKv(path);
  } catch {
    return await Deno.openKv();
  }
})();

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
