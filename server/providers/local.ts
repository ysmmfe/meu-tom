import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  rawSongSchema,
  type RawSong,
  type SongProvider,
  ProviderError,
} from "./types";
export class LocalProvider implements SongProvider {
  name = "local";
  constructor(private directory = join(process.cwd(), "db/demo")) {}
  async fetch(id: string): Promise<RawSong> {
    if (!/^[a-z0-9-]+$/.test(id))
      throw new ProviderError("Identificador local inválido", 400);
    try {
      return rawSongSchema.parse(
        JSON.parse(await readFile(join(this.directory, `${id}.json`), "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new ProviderError("Música não encontrada", 404);
      throw error;
    }
  }
  async find(query: string) {
    const files = (await readdir(this.directory)).filter((f) =>
      f.endsWith(".json"),
    );
    const songs = await Promise.all(
      files.map((f) => this.fetch(f.slice(0, -5))),
    );
    return songs
      .filter((s) =>
        `${s.title} ${s.artist}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
      )
      .map((s) => ({ id: s.slug, title: s.title, artist: s.artist }));
  }
}
