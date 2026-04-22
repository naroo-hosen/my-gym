import { existsSync } from "fs";
import { stat } from "fs/promises";
import { basename, resolve } from "path";
import { createReadStream } from "fs";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getSqliteBackupPath = () => {
  if (process.env.SQLITE_BACKUP_PATH) {
    return resolve(process.env.SQLITE_BACKUP_PATH);
  }

  return resolve(process.cwd(), "prisma", "dev.db");
};

const formatTimestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
};

export const GET = async () => {
  const sqlitePath = getSqliteBackupPath();

  if (!existsSync(sqlitePath)) {
    return Response.json(
      {
        error: "SQLite database file was not found.",
        path: sqlitePath,
      },
      { status: 404 },
    );
  }

  const sqliteStat = await stat(sqlitePath);
  if (!sqliteStat.isFile()) {
    return Response.json(
      {
        error: "SQLite backup path is not a file.",
        path: sqlitePath,
      },
      { status: 400 },
    );
  }

  const fileName = `my-gym-sqlite-${formatTimestamp()}-${basename(sqlitePath)}`;
  const stream = createReadStream(sqlitePath);

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(sqliteStat.size),
      "Content-Type": "application/vnd.sqlite3",
      "Cache-Control": "no-store",
    },
  });
};
