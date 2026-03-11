import type Database from 'better-sqlite3'

const DROP_SQL = `
DROP TABLE IF EXISTS evidencias;
DROP TABLE IF EXISTS votos_individuales;
DROP TABLE IF EXISTS resultados_agregados;
DROP TABLE IF EXISTS votaciones;
DROP TABLE IF EXISTS asuntos;
DROP TABLE IF EXISTS sesiones;
DROP TABLE IF EXISTS fuentes;
DROP TABLE IF EXISTS legisladores;
DROP TABLE IF EXISTS legislaturas;
DROP TABLE IF EXISTS partidos;
`

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS partidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  sigla TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS legislaturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero INTEGER NOT NULL UNIQUE,
  fecha_inicio TEXT NOT NULL,
  fecha_fin TEXT
);

CREATE TABLE IF NOT EXISTS legisladores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  legislatura_id INTEGER NOT NULL REFERENCES legislaturas(id),
  partido_id INTEGER NOT NULL REFERENCES partidos(id),
  titular_id INTEGER,
  camara TEXT NOT NULL CHECK(camara IN ('senado', 'representantes')),
  departamento TEXT,
  origen_partido TEXT NOT NULL DEFAULT 'inferido' CHECK(origen_partido IN ('seed', 'padron', 'inferido', 'sin_asignar'))
);

CREATE TABLE IF NOT EXISTS fuentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK(tipo IN ('json', 'diario_pdf', 'taquigrafica_html', 'dataset', 'audio', 'video', 'manual')),
  url TEXT NOT NULL,
  fecha_captura TEXT NOT NULL,
  hash_contenido TEXT
);

CREATE TABLE IF NOT EXISTS sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  legislatura_id INTEGER NOT NULL REFERENCES legislaturas(id),
  cuerpo TEXT NOT NULL CHECK(cuerpo IN ('senado', 'representantes', 'asamblea_general', 'comision_permanente')),
  fecha TEXT NOT NULL,
  numero INTEGER,
  url_taquigrafica TEXT,
  fuente_id INTEGER REFERENCES fuentes(id)
);

CREATE TABLE IF NOT EXISTS asuntos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  calidad_titulo TEXT NOT NULL DEFAULT 'incompleto' CHECK(calidad_titulo IN ('canonico', 'razonable', 'incompleto')),
  descripcion TEXT,
  tema TEXT,
  codigo_oficial TEXT,
  carpeta TEXT,
  repartido TEXT,
  numero_ley TEXT,
  tipo_asunto TEXT
);

CREATE TABLE IF NOT EXISTS votaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sesion_id INTEGER NOT NULL REFERENCES sesiones(id),
  asunto_id INTEGER REFERENCES asuntos(id),
  orden_sesion INTEGER,
  modalidad TEXT NOT NULL CHECK(modalidad IN ('nominal', 'electronica', 'ordinaria', 'secreta', 'desconocida')),
  estado_cobertura TEXT NOT NULL CHECK(estado_cobertura IN ('individual_confirmado', 'individual_inferido', 'agregado', 'sin_desglose_publico', 'secreto')),
  nivel_confianza TEXT NOT NULL CHECK(nivel_confianza IN ('confirmado', 'alto', 'medio', 'bajo')),
  es_oficial INTEGER NOT NULL DEFAULT 1,
  resultado TEXT CHECK(resultado IN ('afirmativa', 'negativa')),
  fuente_principal_id INTEGER REFERENCES fuentes(id)
);

CREATE TABLE IF NOT EXISTS resultados_agregados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  votacion_id INTEGER NOT NULL UNIQUE REFERENCES votaciones(id),
  afirmativos INTEGER,
  negativos INTEGER,
  abstenciones INTEGER,
  total_presentes INTEGER,
  total_miembros INTEGER,
  unanimidad INTEGER,
  resultado TEXT CHECK(resultado IN ('afirmativa', 'negativa'))
);

CREATE TABLE IF NOT EXISTS votos_individuales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  votacion_id INTEGER NOT NULL REFERENCES votaciones(id),
  legislador_id INTEGER NOT NULL REFERENCES legisladores(id),
  voto TEXT NOT NULL CHECK(voto IN ('afirmativo', 'negativo', 'abstencion', 'ausente', 'sin_emitir')),
  nivel_confianza TEXT NOT NULL CHECK(nivel_confianza IN ('confirmado', 'alto', 'medio', 'bajo')),
  es_oficial INTEGER NOT NULL DEFAULT 1,
  fuente_id INTEGER REFERENCES fuentes(id),
  UNIQUE(votacion_id, legislador_id)
);

CREATE TABLE IF NOT EXISTS evidencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fuente_id INTEGER NOT NULL REFERENCES fuentes(id),
  votacion_id INTEGER REFERENCES votaciones(id),
  voto_individual_id INTEGER REFERENCES votos_individuales(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('texto', 'timestamp', 'ocr', 'nota')),
  texto TEXT,
  timestamp_inicio INTEGER,
  timestamp_fin INTEGER,
  detalle TEXT
);

CREATE INDEX IF NOT EXISTS idx_legisladores_camara ON legisladores(legislatura_id, camara);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_legisladores_leg_camara_nombre ON legisladores(legislatura_id, camara, nombre);
CREATE INDEX IF NOT EXISTS idx_sesiones_cuerpo_fecha ON sesiones(cuerpo, fecha);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_asuntos_codigo_oficial ON asuntos(codigo_oficial);
CREATE INDEX IF NOT EXISTS idx_asuntos_carpeta ON asuntos(carpeta);
CREATE INDEX IF NOT EXISTS idx_votaciones_sesion ON votaciones(sesion_id);
CREATE INDEX IF NOT EXISTS idx_votaciones_asunto ON votaciones(asunto_id);
CREATE INDEX IF NOT EXISTS idx_votos_individuales_legislador ON votos_individuales(legislador_id);
CREATE INDEX IF NOT EXISTS idx_votos_individuales_votacion ON votos_individuales(votacion_id);
`

export function pushearSchema(sqlite: Database.Database) {
  sqlite.exec(DROP_SQL)
  sqlite.exec(SCHEMA_SQL)
}
