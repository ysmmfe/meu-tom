import { notFound } from "next/navigation";
import { getCatalogEntry, searchSchema } from "../../../server/catalog/queries";
import { SongReader } from "../../../features/songs/reader";
import { IndexReader } from "../../../features/songs/index-reader";
export const dynamic = "force-dynamic";
export default async function SongPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const song = await getCatalogEntry((await params).slug);
  if (!song) notFound();
  if (song.availability === "index-only") {
    const query = await searchParams;
    const known = searchSchema
      .pick({ known: true })
      .safeParse({ known: query.known });
    const rawShift =
      typeof query.shift === "string" && query.shift.trim() !== ""
        ? Number(query.shift)
        : NaN;
    const shift =
      Number.isInteger(rawShift) && rawShift >= -5 && rawShift <= 6
        ? rawShift
        : null;
    return (
      <main id="conteudo" className="shell">
        <IndexReader
          song={song}
          sharedKnown={known.success ? known.data.known : []}
          initialShift={shift}
        />
      </main>
    );
  }
  return (
    <main id="conteudo" className="shell">
      <SongReader song={song} />
    </main>
  );
}
