import { searchResultSchema } from "../lib/contracts";
const rounds = Math.max(1, Math.min(30, Number(process.env.BENCH_ROUNDS) || 5));
const cases = [
  { name: "perfil G D Em C", params: { known: "G,D,Em,C" } },
  {
    name: "sem transposição",
    params: { known: "G,D,Em,C", transpose: "false" },
  },
  { name: "um acorde novo", params: { known: "G,D,C", extra: "true" } },
  { name: "artista com acento", params: { known: "G,D,Em,C", q: "Legião" } },
  { name: "página 2", params: { known: "G,D,Em,C", page: "2" } },
  { name: "todos os níveis", params: { known: "G,D,Em,C", playable: "false" } },
  {
    name: "somente cifras completas",
    params: { known: "G,D,Em,C", catalog: "full" },
  },
];
const results = [];
for (const entry of cases) {
  const elapsed: number[] = [];
  let total = 0;
  for (let n = 0; n <= rounds; n++) {
    const params = new URLSearchParams(
      Object.entries(entry.params).filter(
        (pair): pair is [string, string] => typeof pair[1] === "string",
      ),
    );
    const started = performance.now();
    const response = await fetch(`http://localhost:3000/api/songs?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${entry.name}`);
    const body = searchResultSchema.parse(await response.json());
    total = body.total;
    if (n) elapsed.push(Math.round((performance.now() - started) * 10) / 10);
  }
  elapsed.sort((a, b) => a - b);
  results.push({
    name: entry.name,
    params: entry.params,
    total,
    rounds,
    p50Ms: elapsed[Math.floor(elapsed.length / 2)],
    p95Ms: elapsed[Math.ceil(elapsed.length * 0.95) - 1],
    samplesMs: elapsed,
  });
}
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      transport:
        "HTTP localhost production; sequential warmed requests, no concurrency load test",
      results,
    },
    null,
    2,
  ),
);
