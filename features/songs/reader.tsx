"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { SongDetail } from "../../server/catalog/queries";
import {
  adaptations,
  evaluate,
  categoryLabels,
} from "../../lib/music/adaptation";
import { transposeDocument } from "../../lib/parsers/chordpro";
import { equivalent } from "../../lib/music/chords";
import { useProfile } from "../../components/profile";
import { ChordDiagram } from "../../components/chord-diagram";
const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
export function SongReader({ song }: { song: SongDetail }) {
  const [profile] = useProfile();
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const shared = useMemo(
    () => query.get("known")?.split(",").filter(Boolean).slice(0, 40),
    [query],
  );
  const known = shared?.length ? shared : profile;
  const best = useMemo(
    () => adaptations(song.summary, known, { transpose: true, capo: true })[0],
    [song.summary, known],
  );
  const [manualShift, setManualShift] = useState<number | null>(null);
  const [manualCapo, setManualCapo] = useState<number | null>(null);
  const [original, setOriginal] = useState(false);
  const [font, setFont] = useState(18);
  const [selected, setSelected] = useState<string | null>(null);
  const shiftParam = query.get("shift"),
    capoParam = query.get("capo");
  const shift =
    manualShift ??
    (shiftParam !== null &&
    Number.isInteger(Number(shiftParam)) &&
    Number(shiftParam) >= -6 &&
    Number(shiftParam) <= 6
      ? Number(shiftParam)
      : best.semitones);
  const capo =
    manualCapo ??
    (capoParam !== null &&
    Number.isInteger(Number(capoParam)) &&
    Number(capoParam) >= 0 &&
    Number(capoParam) <= 7
      ? Number(capoParam)
      : best.capo);
  const adapted = evaluate(song.summary, known, shift, capo);
  const current = original
    ? evaluate(song.summary, known, 0, song.summary.originalCapo)
    : adapted;
  const document = transposeDocument(song.document, original ? 0 : shift);
  const diagram =
    selected && current.chords.includes(selected)
      ? selected
      : current.chords[0];
  function updateAdaptation(nextShift: number, nextCapo: number) {
    setManualShift(nextShift);
    setManualCapo(nextCapo);
    const params = new URLSearchParams({
      known: known.join(","),
      shift: String(nextShift),
      capo: String(nextCapo),
    });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return (
    <>
      <Link href="/#resultados" className="back-link">
        ← Voltar às músicas
      </Link>
      <header className="reader-heading">
        <div>
          <p className="eyebrow">{song.genre} · Cifra didática original</p>
          <h1>{song.title}</h1>
          <p>{song.artist}</p>
        </div>
        <span className="source-license">{song.source.license}</span>
      </header>
      <section className="adaptation-panel" aria-label="Configuração da cifra">
        <div className="reader-toolbar">
          <div className="segmented" aria-label="Versão da cifra">
            <button aria-pressed={!original} onClick={() => setOriginal(false)}>
              Adaptada para você
            </button>
            <button aria-pressed={original} onClick={() => setOriginal(true)}>
              Original
            </button>
          </div>
          <div className="font-controls">
            <span>Fonte</span>
            <button
              aria-label="A− Diminuir fonte"
              disabled={font <= 14}
              onClick={() => setFont((n) => n - 2)}
            >
              A−
            </button>
            <button
              aria-label="A+ Aumentar fonte"
              disabled={font >= 28}
              onClick={() => setFont((n) => n + 2)}
            >
              A+
            </button>
          </div>
        </div>
        <div className="key-facts" aria-live="polite">
          <div>
            <span>Tom original</span>
            <strong>{song.summary.originalKey ?? "Não informado"}</strong>
          </div>
          <div>
            <span>Tom das formas</span>
            <strong>{current.shapeKey ?? "Não informado"}</strong>
          </div>
          <div>
            <span>Tom efetivo</span>
            <strong data-testid="effective-key">
              {current.effectiveKey ?? "Não informado"}
            </strong>
          </div>
          <div>
            <span>Capotraste</span>
            <strong>
              {current.capo ? `${current.capo}ª casa` : "Sem capotraste"}
            </strong>
          </div>
        </div>
        {!original && (
          <div className="adapt-controls">
            <label>
              Transposição das formas
              <select
                aria-label="Transposição das formas"
                value={shift}
                onChange={(e) => updateAdaptation(Number(e.target.value), capo)}
              >
                {Array.from({ length: 12 }, (_, i) => i - 5).map((n) => (
                  <option key={n} value={n}>
                    {n === 0
                      ? "Original (0)"
                      : `${n > 0 ? "+" : ""}${n} semitons`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Capotraste
              <select
                aria-label="Capotraste"
                value={capo}
                onChange={(e) =>
                  updateAdaptation(shift, Number(e.target.value))
                }
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <option value={i} key={i}>
                    {i ? `${i}ª casa` : "Sem capotraste"}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => updateAdaptation(best.semitones, best.capo)}
            >
              Usar recomendação
            </button>
          </div>
        )}
        <p className="adaptation-status" role="status">
          {known.length
            ? categoryLabels[current.category]
            : "Selecione seus acordes na descoberta para receber uma recomendação pessoal"}
          {!original && current.preservesKey
            ? " · Altura original preservada"
            : ""}
        </p>
        {current.warnings.map((w) => (
          <p className="notice" key={w}>
            {w}
          </p>
        ))}
        {!!current.unknown.length && known.length > 0 && (
          <p className="notice">
            Para aprender nesta versão: {current.unknown.join(", ")}
          </p>
        )}
        {song.document.warnings.map((w) => (
          <p className="notice" key={w}>
            {w}
          </p>
        ))}
      </section>
      <div className="reader-layout">
        <article
          className="song-sheet"
          aria-label={original ? "Cifra original" : "Cifra adaptada"}
          style={{ fontSize: font }}
          data-testid="song-sheet"
        >
          {document.sections.map((section, s) => (
            <section className="sheet-section" key={s}>
              <h2>
                {section.name}
                {section.repeat > 1 ? <span> {section.repeat}×</span> : null}
              </h2>
              {section.lines.map((line, l) => (
                <div className="sheet-line" key={l}>
                  {line.map((part, p) => (
                    <span className="lyric-segment" key={p}>
                      {part.chord ? (
                        <button
                          className="inline-chord"
                          onClick={() => setSelected(part.chord!)}
                          aria-label={`Ver diagrama de ${part.chord}`}
                        >
                          {part.chord}
                        </button>
                      ) : (
                        <span className="chord-spacer" aria-hidden="true">
                           
                        </span>
                      )}
                      <span className="lyric-text">{part.text || " "}</span>
                    </span>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </article>
        <aside className="chord-aside" aria-labelledby="needed-heading">
          <h2 id="needed-heading">Acordes desta versão</h2>
          <p className="muted">Toque em um acorde para ver a posição</p>
          <div className="needed-chords">
            {current.chords.map((c) => (
              <button
                key={c}
                aria-pressed={diagram === c}
                onClick={() => setSelected(c)}
              >
                {c}
                <small>
                  {known.some((k) => equivalent(k, c))
                    ? "Conheço"
                    : "Para aprender"}
                </small>
              </button>
            ))}
          </div>
          <div aria-live="polite">
            {diagram && <ChordDiagram symbol={diagram} />}
          </div>
          <p className="diagram-help">
            Afinação padrão E A D G B E<br />
            Dedos numerados de 1 a 4<br />
            As casas são relativas ao capotraste
          </p>
          <details>
            <summary>Sobre esta cifra</summary>
            <p>
              Composição didática original, disponível sob {song.source.license}
              . Nenhuma simplificação harmônica é aplicada.
            </p>
            <p>Fonte: {song.source.provider}</p>
            <p>{song.source.permission}</p>
          </details>
        </aside>
      </div>
    </>
  );
}
