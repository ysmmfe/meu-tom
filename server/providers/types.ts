import { z } from "zod";
export const rawSongSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  genre: z.string().min(1).max(80),
  format: z.enum(["chordpro", "plain"]),
  content: z.string().min(1).max(200000),
  source: z.object({
    provider: z.string().min(1).max(80),
    url: z.string().min(1).max(1000),
    license: z.string().min(1).max(300),
    permission: z.string().min(1).max(1000),
    publishable: z.boolean(),
  }),
});
export type RawSong = z.infer<typeof rawSongSchema>;
export interface SongProvider {
  name: string;
  find(query: string): Promise<{ id: string; title: string; artist: string }[]>;
  fetch(id: string): Promise<RawSong>;
}
export class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
