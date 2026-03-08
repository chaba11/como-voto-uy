import type Database from 'better-sqlite3'

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS partidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  sigla TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS legisladores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  partido_id INTEGER NOT NULL REFERENCES partidos(id),
  titular_id INTEGER,
  camara TEXT NOT NULL CHECK(camara IN ('senado', 'representantes')),
  departamento TEXT
);

CREATE TABLE IF NOT EXISTS legislaturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero INTEGER NOT NULL UNIQUE,
  fecha_inicio TEXT NOT NULL,
  fecha_fin TEXT
);

CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  legislatura_id INTEGER NOT NULL REFERENCES legislaturas(id),
  camara TEXT NOT NULL CHECK(camara IN ('senado', 'representantes')),
  fecha TEXT NOT NULL,
  numero INTEGER,
  url_taquigrafica TEXT
);

CREATE TABLE IF NOT EXISTS proyectos_ley (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tema TEXT,
  sesion_id INTEGER NOT NULL REFERENCES sesiones(id)
);

CREATE TABLE IF NOT EXISTS votos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proyecto_ley_id INTEGER NOT NULL REFERENCES proyectos_ley(id),
  legislador_id INTEGER NOT NULL REFERENCES legisladores(id),
  voto TEXT NOT NULL CHECK(voto IN ('afirmativo', 'negativo', 'ausente'))
);
`

export function pushearSchema(sqlite: Database.Database) {
  sqlite.exec(SCHEMA_SQL)
}
