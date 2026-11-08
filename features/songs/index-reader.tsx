"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useProfile } from "../../components/profile";
import { ChordDiagram } from "../../components/chord-diagram";
import { evaluateIndex } from "../../lib/music/index-adaptation";
import type { IndexedSong } from "../../server/catalog/offline";
export function IndexReader({
  song,
  sharedKnown,
  initialShift,
}: {
  song: IndexedSong;
  sharedKnown: string[];
  initialShift: number | null;
}) {
  const [profile] = useProfile();
  const known = sharedKnown.length ? sharedKnown : profile;
  const best = useMemo(
    () =>
      Array.from({ length: 12 }, (_, n) => (n > 6 ? n - 12 : n))
        .map((shift) => evaluateIndex(song.chords, known, shift))
        .sort(
          (a, b) =>
            a.unknown.length - b.unknown.length ||
            a.score - b.score ||
            Math.abs(a.semitones) - Math.abs(b.semitones) ||
            a.semitones - b.semitones,
        )[0],
    [song.chords, known],
  );
  const [manualShift, setManualShift] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const current = evaluateIndex(
    song.chords,
    known,
    manualShift ?? initialShift ?? best.semitones,
  );
  const diagram =
    selected && current.chords.includes(selected)
      ? selected
      : current.chords[0];
  function changeShift(shift: number) {
    setManualShift(shift);
    const query = new URLSearchParams({
      known: known.join(","),
      shift: String(shift),
    });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${query}`,
    );
  }
  return (
    <>
      <Link href="/#resultados" className="back-link">
        ← Voltar às músicas
      </Link>
      <header className="reader-heading index-heading">
        <div>
          <p className="eyebrow">{song.genre} · Índice offline de acordes</p>
          <h1>{song.title}</h1>
          <p>{song.artist}</p>
        </div>
      </header>
      <section className="index-notice" aria-labelledby="index-limit-title">
        <h2 id="index-limit-title">Esta música ainda não tem cifra completa</h2>
        <p>
          O repertório offline informa somente um conjunto de acordes, sem
          letra, ordem, ritmo ou posições no verso. Ele ajuda a descobrir
          músicas, mas não substitui uma cifra.
        </p>
        <p>
          Tom da gravação e capotraste original não confirmados. Os nomes podem
          estar sem acentos na fonte.
        </p>
      </section>
      <section className="index-content" aria-labelledby="index-chords-title">
        <div>
          <h2 id="index-chords-title">Acordes do índice</h2>
          <p className="muted">
            Conjunto sem ordem de execução · {song.chords.join(" · ")}
          </p>
          <label className="index-shift">
            Transposição do conjunto
            <select
              value={current.semitones}
              onChange={(e) => changeShift(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, n) => n - 5).map((shift) => (
                <option key={shift} value={shift}>
                  {shift > 0 ? "+" : ""}
                  {shift} semitons
                </option>
              ))}
            </select>
          </label>
          <p className="adaptation-status" role="status">
            {!known.length
              ? "Selecione seus acordes na busca para conferir a compatibilidade"
              : current.compatible
                ? "Conjunto compatível com seus acordes"
                : `${current.unknown.length} acorde(s) fora do seu perfil`}
          </p>
          <p className="muted">
            Compatibilidade dos símbolos, não uma garantia sobre o arranjo ou a
            dificuldade da música.
          </p>
          <div className="needed-chords index-chords">
            {current.chords.map((chord) => (
              <button
                key={chord}
                aria-pressed={diagram === chord}
                onClick={() => setSelected(chord)}
              >
                {chord}
                <small>
                  {current.unknown.includes(chord) ? "A aprender" : "No perfil"}
                </small>
              </button>
            ))}
          </div>
        </div>
        <aside
          className="index-diagram"
          aria-label="Posição do acorde selecionado"
        >
          <ChordDiagram symbol={diagram} />
          <p className="muted">
            Afinação padrão E A D G B E · posições sem recomendação de
            capotraste para esta gravação
          </p>
        </aside>
      </section>
      <details className="index-provenance">
        <summary>Fonte e limites destes dados</summary>
        <p>
          Fonte: {song.source.provider}.{" "}
          {song.source.provider === "chorrrds"
            ? "Base offline de Bruna Wundervald."
            : "Conjunto autoral de teste."}{" "}
          Revisão {song.source.revision.slice(0, 12)}.
        </p>
        <p>{song.source.rightsNotice}</p>
        <p>
          Licença do repositório: {song.source.license}. Isso não licencia as
          obras musicais.
        </p>
        <p>
          Registro na fonte: {song.source.rawArtist} / {song.source.rawTitle}
        </p>
        <a href={song.source.url} target="_blank" rel="noopener noreferrer">
          Consultar a fonte dos dados
        </a>
      </details>
    </>
  );
}
