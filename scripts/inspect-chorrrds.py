"""Inspeção offline de all.rda; não importa conteúdo no banco do Meu Tom.

uv run --isolated --no-project --with rdata==1.1.0 python \
  scripts/inspect-chorrrds.py /caminho/all.rda /tmp/chorrrds-inspection
"""
import argparse
import json
from importlib.metadata import version
from pathlib import Path

import rdata

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
frame = rdata.read_rda(args.source)["all"]
frame["chord_text"] = frame["chord"].astype(str).str.strip()
counts = frame["chord_text"].value_counts()
groups = frame.groupby(["artist", "music"], observed=True)["chord_text"].agg(
    lambda series: list(dict.fromkeys(series))
)
summary = {
    "rdataVersion": version("rdata"),
    "rows": len(frame),
    "columns": [column for column in frame.columns if column != "chord_text"],
    "artists": int(frame["artist"].nunique()),
    "artistSongPairs": len(groups),
    "uniqueChordStrings": len(counts),
    "missing": {
        str(key): int(value)
        for key, value in frame.drop(columns="chord_text").isna().sum().items()
    },
}
args.output.mkdir(parents=True, exist_ok=True)
for name, data in {
    "dataset-summary": summary,
    "chord-counts": [
        {"symbol": str(symbol), "count": int(count)} for symbol, count in counts.items()
    ],
    "song-symbols": groups.tolist(),
}.items():
    (args.output / f"{name}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
print(json.dumps(summary, ensure_ascii=False, indent=2))
