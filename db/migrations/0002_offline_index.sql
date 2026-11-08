CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TABLE offline_datasets (
  id text PRIMARY KEY, provider text NOT NULL, revision text NOT NULL,
  sha256 text NOT NULL, source_url text NOT NULL, license text NOT NULL,
  rights_notice text NOT NULL, imported_at timestamp NOT NULL DEFAULT now(),
  report jsonb NOT NULL
);
CREATE TABLE indexed_songs (
  id text PRIMARY KEY, slug text NOT NULL UNIQUE,
  dataset_id text NOT NULL REFERENCES offline_datasets(id),
  raw_artist text NOT NULL, raw_title text NOT NULL,
  artist text NOT NULL, title text NOT NULL, artist_key text NOT NULL, title_key text NOT NULL,
  genre text NOT NULL, chords jsonb NOT NULL,
  declared_key text,
  UNIQUE(dataset_id, raw_artist, raw_title)
);
CREATE INDEX indexed_artist_idx ON indexed_songs(artist_key);
CREATE INDEX indexed_title_search_idx ON indexed_songs USING gin(title_key gin_trgm_ops);
CREATE INDEX indexed_artist_search_idx ON indexed_songs USING gin(artist_key gin_trgm_ops);
CREATE TABLE indexed_variants (
  song_id text NOT NULL REFERENCES indexed_songs(id) ON DELETE CASCADE,
  shift integer NOT NULL CHECK(shift BETWEEN -5 AND 6),
  identities text[] NOT NULL,
  complexity integer NOT NULL,
  PRIMARY KEY(song_id,shift)
);
CREATE INDEX indexed_identities_idx ON indexed_variants USING gin(identities);
ANALYZE indexed_songs;
ANALYZE indexed_variants;
