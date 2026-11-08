import { sql } from "../../db/client";
import { chordIdentity } from "../../lib/music/chords";
import { evaluateIndex } from "../../lib/music/index-adaptation";
import { foldText } from "../../lib/catalog/offline";
import type { SearchInput } from "./queries";
const escaped = (text: string) =>
  foldText(text).replace(/[\\%_]/g, (char) => "\\" + char);
interface IndexRow {
  slug: string;
  title: string;
  artist: string;
  genre: string;
  chords: string[];
  shift: number;
  score: number;
}
export async function searchIndex(input: SearchInput) {
  if (input.catalog === "full" || !input.known.length)
    return { items: [], total: 0 };
  const known = [...new Set(input.known.map(chordIdentity))];
  const sort =
    input.sort === "title"
      ? sql`title_key COLLATE "C"`
      : input.sort === "artist"
        ? sql`artist_key COLLATE "C"`
        : input.sort === "fewest"
          ? sql`jsonb_array_length(chords)`
          : sql`score`;
  const [result] = await sql<{ total: number; items: IndexRow[] }[]>`
    WITH candidates AS (
      SELECT s.*,v.shift,v.complexity,
        CASE WHEN v.identities <@ ${sql.array(known)}::text[] THEN 0 ELSE
          (SELECT count(*)::int FROM unnest(v.identities) identity WHERE NOT(identity = ANY(${sql.array(known)}::text[]))) END AS n_unknown
      FROM indexed_songs s JOIN indexed_variants v ON v.song_id=s.id
      WHERE (${input.transpose} OR v.shift=0)
        AND (${input.q === ""} OR s.title_key LIKE ${"%" + escaped(input.q) + "%"} OR s.artist_key LIKE ${"%" + escaped(input.q) + "%"})
        AND (${input.title === ""} OR s.title_key LIKE ${"%" + escaped(input.title) + "%"})
        AND (${input.artist === ""} OR s.artist_key LIKE ${"%" + escaped(input.artist) + "%"})
        AND (${input.genre === ""} OR s.genre=${input.genre})
        AND (${!input.playable || input.extra} OR v.identities <@ ${sql.array(known)}::text[])
        AND (${!input.playable} OR cardinality(v.identities)<=${known.length + (input.extra ? 1 : 0)})
    ), best AS (
      SELECT DISTINCT ON(id) *, n_unknown*1000+complexity*2+abs(shift)*0.1 AS score
      FROM candidates WHERE (${!input.playable} OR n_unknown<=${input.extra ? 1 : 0})
      ORDER BY id,n_unknown,n_unknown*1000+complexity*2+abs(shift)*0.1,abs(shift),shift
    ), ranked AS (
      SELECT * FROM best ORDER BY (n_unknown=0) DESC,${sort},title_key COLLATE "C",artist_key COLLATE "C",slug COLLATE "C"
      LIMIT ${input.page * 6}
    )
    SELECT (SELECT count(*)::int FROM best) AS total,
      coalesce((SELECT jsonb_agg(jsonb_build_object('slug',slug,'title',title,'artist',artist,'genre',genre,'chords',chords,'shift',shift,'score',score)
        ORDER BY (n_unknown=0) DESC,${sort},title_key COLLATE "C",artist_key COLLATE "C",slug COLLATE "C") FROM ranked),'[]'::jsonb) AS items
  `;
  return {
    total: result.total,
    items: result.items.map((row) => ({
      slug: row.slug,
      title: row.title,
      artist: row.artist,
      genre: row.genre,
      availability: "index-only" as const,
      adaptation: evaluateIndex(row.chords, input.known, row.shift),
    })),
  };
}
export async function getIndexedSong(slug: string) {
  const [row] = await sql<
    {
      slug: string;
      title: string;
      artist: string;
      genre: string;
      chords: string[];
      declared_key: string | null;
      raw_artist: string;
      raw_title: string;
      provider: string;
      revision: string;
      source_url: string;
      license: string;
      rights_notice: string;
    }[]
  >`
    SELECT s.*,d.provider,d.revision,d.source_url,d.license,d.rights_notice FROM indexed_songs s
    JOIN offline_datasets d ON d.id=s.dataset_id WHERE s.slug=${slug} LIMIT 1`;
  if (!row) return null;
  return {
    availability: "index-only" as const,
    slug: row.slug,
    title: row.title,
    artist: row.artist,
    genre: row.genre,
    chords: row.chords,
    declaredKey: row.declared_key,
    source: {
      provider: row.provider,
      url: row.source_url,
      revision: row.revision,
      license: row.license,
      rightsNotice: row.rights_notice,
      rawArtist: row.raw_artist,
      rawTitle: row.raw_title,
    },
  };
}
export type IndexedSong = NonNullable<
  Awaited<ReturnType<typeof getIndexedSong>>
>;
