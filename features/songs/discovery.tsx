"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useProfile } from "../../components/profile";
import { equivalent } from "../../lib/music/chords";
import { categoryLabels } from "../../lib/music/adaptation";
import { searchResultSchema } from "../../lib/contracts";
import { mergeChordInput } from "../chords/input";
import type { SearchResult } from "../../server/catalog/queries";

const common = [
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "Am",
  "Dm",
  "Em",
  "G7",
  "C7",
  "D7",
  "B",
  "Bm",
  "E7",
  "A7",
  "B7",
];
const presets = [
  ["C", "G", "Am", "F"],
  ["G", "D", "Em", "C"],
  ["A", "D", "E"],
  ["C", "F", "G"],
];
const defaults = {
  catalog: "all",
  q: "",
  artist: "",
  genre: "",
  sort: "ease",
  transpose: true,
  capo: true,
  playable: true,
  extra: false,
};
export function Discovery() {
  const [known, setKnown] = useProfile();
  const [filters, setFilters] = useState(defaults);
  const [custom, setCustom] = useState("");
  const [chordError, setChordError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          known: known.join(","),
          page: String(page),
          ...Object.fromEntries(
            Object.entries(filters).map(([k, v]) => [k, String(v)]),
          ),
        });
        const response = await fetch(`/api/songs?${query}`, {
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "Não foi possível buscar músicas");
        setResult(searchResultSchema.parse(body));
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Falha ao buscar músicas");
          setResult(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [known, filters, page, refresh]);
  function choose(chords: string[]) {
    setKnown(chords);
    setPage(1);
    setChordError("");
  }
  function toggle(chord: string) {
    if (known.some((c) => equivalent(c, chord))) {
      choose(known.filter((c) => !equivalent(c, chord)));
      return;
    }
    try {
      choose(mergeChordInput(known, chord));
    } catch (e) {
      setChordError(e instanceof Error ? e.message : "Acorde inválido");
    }
  }
  function addInput(): boolean {
    try {
      choose(mergeChordInput(known, custom));
      setCustom("");
      return true;
    } catch (e) {
      setChordError(e instanceof Error ? e.message : "Acorde inválido");
      return false;
    }
  }
  function search(e: FormEvent) {
    e.preventDefault();
    if (custom.trim() && !addInput()) return;
    setPage(1);
    setRefresh((n) => n + 1);
  }
  function change<K extends keyof typeof defaults>(
    key: K,
    value: (typeof defaults)[K],
  ) {
    setFilters((v) => ({ ...v, [key]: value }));
    setPage(1);
  }
  function reset() {
    choose([]);
    setCustom("");
    setFilters(defaults);
    setError("");
  }
  const active = Object.entries(filters).filter(
    ([k, v]) => v !== defaults[k as keyof typeof defaults],
  );
  const advancedCount =
    Number(!!filters.artist) +
    Number(!filters.capo) +
    Number(filters.extra) +
    Number(filters.catalog !== "all");
  return (
    <>
      <section
        className="discovery-panel"
        aria-label="Encontre músicas pelos seus acordes"
      >
        <form onSubmit={search}>
          <label className="sr-only" htmlFor="chord-input">
            Seus acordes
          </label>
          <div className="chip-input">
            {known.map((chord) => (
              <button
                type="button"
                className="selected-chord"
                key={chord}
                aria-label={`Remover ${chord}`}
                onClick={() => choose(known.filter((c) => c !== chord))}
              >
                <span>{chord}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <input
              id="chord-input"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setChordError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) {
                  e.preventDefault();
                  addInput();
                }
                if (e.key === "Backspace" && !custom && known.length)
                  choose(known.slice(0, -1));
              }}
              placeholder={known.length ? "Outro acorde…" : "C, G, Am, F …"}
              maxLength={1000}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!chordError}
              aria-describedby={chordError ? "chord-error" : "chord-hint"}
            />
          </div>
          <div className="chord-input-meta">
            <p id="chord-hint" aria-live="polite">
              {known.length
                ? `${known.length} ${known.length === 1 ? "acorde selecionado" : "acordes selecionados"}`
                : "Separe por vírgulas ou pressione Enter"}
            </p>
            {known.length > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={() => choose([])}
              >
                Limpar acordes
              </button>
            )}
          </div>
          {chordError && (
            <p id="chord-error" role="alert" className="error-text">
              {chordError}
            </p>
          )}
          <div
            className="quick-add"
            role="group"
            aria-label="Conjuntos e acordes disponíveis"
          >
            {presets.map((p) => (
              <button
                type="button"
                className="preset"
                key={p.join()}
                aria-pressed={
                  p.length === known.length &&
                  p.every((chord) => known.some((c) => equivalent(c, chord)))
                }
                onClick={() => choose(p)}
              >
                {p.join(" ")}
              </button>
            ))}
            <span className="quick-divider" aria-hidden="true" />
            {common.map((chord) => (
              <button
                type="button"
                className="chord-key"
                key={chord}
                aria-pressed={known.some((c) => equivalent(c, chord))}
                onClick={() => toggle(chord)}
              >
                {chord}
              </button>
            ))}
          </div>
          <div className="filter-grid">
            <label htmlFor="song-query">
              Música ou artista
              <input
                id="song-query"
                value={filters.q}
                onChange={(e) => change("q", e.target.value)}
                placeholder="Ex.: Legião Urbana, Caetano"
                maxLength={200}
              />
            </label>
            <label htmlFor="song-sort">
              Ordenar por
              <select
                id="song-sort"
                value={filters.sort}
                onChange={(e) => change("sort", e.target.value)}
              >
                <option value="ease">Facilidade</option>
                <option value="title">Título A–Z</option>
                <option value="artist">Artista A–Z</option>
                <option value="fewest">Menos acordes</option>
              </select>
            </label>
            <label htmlFor="song-genre">
              Gênero
              <select
                id="song-genre"
                value={filters.genre}
                onChange={(e) => change("genre", e.target.value)}
              >
                <option value="">Todos</option>
                {result?.genres.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="toggles">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={filters.playable}
                onChange={(e) => change("playable", e.target.checked)}
              />
              Apenas acordes compatíveis
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={filters.transpose}
                onChange={(e) => change("transpose", e.target.checked)}
              />
              Incluir transposições
            </label>
          </div>
          <details className="advanced-filters">
            <summary>
              Mais opções{advancedCount > 0 ? ` (${advancedCount})` : ""}
            </summary>
            <div className="advanced-content">
              <div className="catalog-controls">
                <label>
                  Catálogo
                  <select
                    value={filters.catalog}
                    onChange={(e) => change("catalog", e.target.value)}
                  >
                    <option value="all">Todo o repertório</option>
                    <option value="index">Repertório offline (índice)</option>
                    <option value="full">Cifras completas</option>
                  </select>
                </label>
                <label htmlFor="song-artist">
                  Artista
                  <input
                    id="song-artist"
                    value={filters.artist}
                    onChange={(e) => change("artist", e.target.value)}
                    placeholder="Filtrar só por artista"
                    maxLength={200}
                  />
                </label>
              </div>
              <div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={filters.capo}
                    onChange={(e) => change("capo", e.target.checked)}
                  />
                  Permitir capotraste
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={filters.extra}
                    onChange={(e) => change("extra", e.target.checked)}
                  />
                  Incluir um acorde novo
                </label>
              </div>
            </div>
          </details>
          {active.length > 0 && (
            <button
              type="button"
              className="text-button clear-filters"
              onClick={() => {
                setFilters(defaults);
                setPage(1);
              }}
            >
              Limpar filtros ({active.length})
            </button>
          )}
          <div className="search-actions">
            <button
              type="submit"
              className="primary"
              disabled={!known.length && !custom.trim()}
            >
              Buscar músicas
            </button>
            <button type="button" onClick={reset}>
              Limpar
            </button>
          </div>
        </form>
      </section>
      <section
        id="resultados"
        className={known.length || error ? "results" : "empty-results"}
        aria-label="Resultados da busca"
        aria-busy={loading}
      >
        {(known.length > 0 || error) && (
          <>
            <div className="results-heading">
              <h2>Resultados para seus acordes</h2>
              <span className="count" role="status">
                {loading
                  ? "Buscando…"
                  : result && known.length
                    ? `${result.total} ${result.total === 1 ? "resultado" : "resultados"}`
                    : ""}
              </span>
            </div>
            <p className="catalog-note">
              Repertório offline: índice de acordes, sem letra · Cifras
              completas: composições didáticas CC0
            </p>
          </>
        )}
        {error ? (
          <div className="empty error-box" role="alert">
            <h3>Não foi possível carregar o catálogo</h3>
            <p>{error}</p>
            <button onClick={() => setRefresh((n) => n + 1)}>
              Tentar novamente
            </button>
          </div>
        ) : !known.length ? (
          <p className="start-hint">Selecione seus acordes para começar</p>
        ) : result && !result.total && !loading ? (
          <div className="empty">
            <h3>Nenhuma música por enquanto</h3>
            <p>
              Desmarque “Apenas acordes compatíveis” para ver outros níveis,
              inclua um acorde novo ou limpe os filtros.
            </p>
          </div>
        ) : (
          <div className={`song-list ${loading ? "is-loading" : ""}`}>
            {result?.items.map((song) => (
              <Link
                className="song-row"
                prefetch={false}
                key={song.slug}
                href={`/musicas/${song.slug}?known=${encodeURIComponent(known.join(","))}&shift=${song.adaptation.semitones}&capo=${song.adaptation.capo}`}
              >
                <div className="song-name">
                  <h3>{song.title}</h3>
                  <p>
                    {song.artist}
                    <span> · {song.genre}</span>
                  </p>
                </div>
                <div className="song-match">
                  <span
                    className={`compatibility ${song.adaptation.compatible ? "match" : ""}`}
                  >
                    {song.availability === "index-only"
                      ? song.adaptation.compatible
                        ? "Conjunto de acordes compatível"
                        : "Conjunto com acordes a aprender"
                      : categoryLabels[song.adaptation.category]}
                  </span>
                  <div className="result-chords">
                    {song.adaptation.chords.map((c) => (
                      <span
                        key={c}
                        className={
                          song.adaptation.unknown.includes(c) ? "unknown" : ""
                        }
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <p>
                    {song.availability === "index-only"
                      ? "Índice · sem cifra completa · "
                      : "Cifra completa · "}
                    {song.adaptation.unknown.length > 0
                      ? `${song.adaptation.unknown.length} acorde(s) para aprender · `
                      : ""}
                    {song.adaptation.capo
                      ? `Capotraste ${song.adaptation.capo}ª casa · `
                      : ""}
                    {song.adaptation.semitones
                      ? `Transposição ${song.adaptation.semitones > 0 ? "+" : ""}${song.adaptation.semitones} semitons`
                      : song.availability === "index-only"
                        ? "Conjunto da fonte"
                        : "Formas originais"}
                  </p>
                </div>
                <span className="row-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
        {known.length > 0 && result && result.total > result.pageSize && (
          <nav className="pagination" aria-label="Paginação">
            <button
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {Math.ceil(result.total / result.pageSize)}
            </span>
            <button
              disabled={
                page >= Math.ceil(result.total / result.pageSize) || loading
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
      </section>
    </>
  );
}
