"""Exporta somente metadados e conjuntos de acordes (sem ordem, letras ou seções)."""
import argparse
import hashlib
import json
from pathlib import Path
import rdata

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
checksum = hashlib.sha256(args.source.read_bytes()).hexdigest()
expected = '0fefd3d830e9a982fdc5a837a6f0bc2bc0cc8a5987d1c9229567896cda3c0ca9'
if checksum != expected:
    raise SystemExit('Checksum do corpus não confere; esta revisão não foi homologada.')
frame = rdata.read_rda(args.source)['all']
genres = rdata.read_rda(args.source.parent / 'genre.rda')['genre']
lookup = {str(row.artist).strip(): str(row.genre).strip() for row in genres.itertuples()}
rows = []
for (artist, music), group in frame.groupby(['artist', 'music'], observed=True):
    rows.append({
        'artist': str(artist), 'music': str(music),
        'genre': lookup.get(str(artist).strip(), 'Não informado'),
        'chords': sorted(set(str(value).strip() for value in group['chord'])),
        'keys': sorted(set(str(value).strip() for value in group['key'])),
    })
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({
    'provider': 'chorrrds', 'revision': 'e01864278aab879fbc13e21d5eb89e365b16741d',
    'sha256': checksum, 'rows': rows,
}, ensure_ascii=False), encoding='utf-8')
print(json.dumps({'groups': len(rows), 'sha256': checksum, 'output': str(args.output)}, indent=2))
