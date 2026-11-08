import { getShape } from "../lib/music/diagrams";
export function ChordDiagram({ symbol }: { symbol: string }) {
  const shape = getShape(symbol);
  if (!shape)
    return (
      <p className="muted">
        Diagrama de {symbol} ainda não disponível. O acorde foi preservado sem
        simplificação.
      </p>
    );
  const base = Math.max(1, Math.min(...shape.frets.filter((f) => f > 0)));
  return (
    <figure className="diagram">
      <svg
        viewBox="0 0 148 168"
        role="img"
        aria-label={`${symbol}, afinação E A D G B E; casas ${shape.frets.map((f) => (f < 0 ? "não tocar" : f)).join(", ")}${shape.barre ? "; com pestana" : ""}`}
      >
        <text
          x="74"
          y="16"
          textAnchor="middle"
          fontSize="16"
          fill="currentColor"
        >
          {symbol}
        </text>
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={`s${i}`}
            x1={28 + i * 18}
            x2={28 + i * 18}
            y1="44"
            y2="132"
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={`f${i}`}
            x1="28"
            x2="118"
            y1={44 + i * 22}
            y2={44 + i * 22}
            stroke="currentColor"
            strokeWidth={i === 0 && base === 1 ? 3 : 1}
          />
        ))}
        {base > 1 && (
          <text x="6" y="60" fontSize="12">
            {base}ª
          </text>
        )}
        {shape.barre && (
          <line
            x1={28 + shape.barre.from * 18}
            x2={28 + shape.barre.to * 18}
            y1={55 + (shape.barre.fret - base) * 22}
            y2={55 + (shape.barre.fret - base) * 22}
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
          />
        )}
        {shape.frets.map((f, i) =>
          f <= 0 ? (
            <text
              key={i}
              x={28 + i * 18}
              y="36"
              textAnchor="middle"
              fontSize="13"
            >
              {f < 0 ? "×" : "○"}
            </text>
          ) : (
            <g key={i}>
              <circle
                cx={28 + i * 18}
                cy={55 + (f - base) * 22}
                r="7"
                fill="currentColor"
              />
              <text
                x={28 + i * 18}
                y={59 + (f - base) * 22}
                textAnchor="middle"
                fontSize="10"
                fill="white"
              >
                {shape.fingers[i] || ""}
              </text>
            </g>
          ),
        )}
        {["E", "A", "D", "G", "B", "E"].map((s, i) => (
          <text
            key={i}
            x={28 + i * 18}
            y="152"
            textAnchor="middle"
            fontSize="11"
          >
            {s}
          </text>
        ))}
      </svg>
      <figcaption>
        × não tocar · ○ solta
        {shape.barre ? ` · pestana na ${shape.barre.fret}ª casa` : ""}
      </figcaption>
    </figure>
  );
}
