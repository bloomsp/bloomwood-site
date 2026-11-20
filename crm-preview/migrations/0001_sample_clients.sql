CREATE TABLE sample_clients (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  service TEXT NOT NULL,
  locality TEXT NOT NULL
);
INSERT INTO sample_clients VALUES
  ('sample-001','Fernvale Sample Studio','Editing','Cairns'),
  ('sample-002','Coral Sample Office','IT support','Port Douglas'),
  ('sample-003','Wattle Sample Workshop','Website design','Atherton');
