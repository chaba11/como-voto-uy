import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const partidos = sqliteTable('partidos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  sigla: text('sigla').notNull(),
  color: text('color').notNull(),
})

export const legisladores = sqliteTable(
  'legisladores',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    partidoId: integer('partido_id')
      .notNull()
      .references(() => partidos.id),
    titularId: integer('titular_id'),
    camara: text('camara', { enum: ['senado', 'representantes'] }).notNull(),
    departamento: text('departamento'),
  },
  (table) => ({
    porCamara: index('idx_legisladores_camara').on(table.camara),
  }),
)

export const legislaturas = sqliteTable('legislaturas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  numero: integer('numero').notNull().unique(),
  fechaInicio: text('fecha_inicio').notNull(),
  fechaFin: text('fecha_fin'),
})

export const fuentes = sqliteTable('fuentes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tipo: text('tipo', {
    enum: [
      'json',
      'diario_pdf',
      'taquigrafica_html',
      'dataset',
      'audio',
      'video',
      'manual',
    ],
  }).notNull(),
  url: text('url').notNull(),
  fechaCaptura: text('fecha_captura').notNull(),
  hashContenido: text('hash_contenido'),
})

export const sesiones = sqliteTable(
  'sesiones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    legislaturaId: integer('legislatura_id')
      .notNull()
      .references(() => legislaturas.id),
    cuerpo: text('cuerpo', {
      enum: [
        'senado',
        'representantes',
        'asamblea_general',
        'comision_permanente',
      ],
    }).notNull(),
    fecha: text('fecha').notNull(),
    numero: integer('numero'),
    urlTaquigrafica: text('url_taquigrafica'),
    fuenteId: integer('fuente_id').references(() => fuentes.id),
  },
  (table) => ({
    porCuerpoFecha: index('idx_sesiones_cuerpo_fecha').on(table.cuerpo, table.fecha),
  }),
)

export const asuntos = sqliteTable(
  'asuntos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion'),
    tema: text('tema'),
    codigoOficial: text('codigo_oficial'),
    carpeta: text('carpeta'),
    repartido: text('repartido'),
    numeroLey: text('numero_ley'),
    tipoAsunto: text('tipo_asunto'),
  },
  (table) => ({
    codigoOficialIdx: uniqueIndex('uidx_asuntos_codigo_oficial').on(table.codigoOficial),
    carpetaIdx: index('idx_asuntos_carpeta').on(table.carpeta),
  }),
)

export const votaciones = sqliteTable(
  'votaciones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sesionId: integer('sesion_id')
      .notNull()
      .references(() => sesiones.id),
    asuntoId: integer('asunto_id').references(() => asuntos.id),
    ordenSesion: integer('orden_sesion'),
    modalidad: text('modalidad', {
      enum: ['nominal', 'electronica', 'ordinaria', 'secreta', 'desconocida'],
    }).notNull(),
    estadoCobertura: text('estado_cobertura', {
      enum: [
        'individual_confirmado',
        'individual_inferido',
        'agregado',
        'sin_desglose_publico',
        'secreto',
      ],
    }).notNull(),
    nivelConfianza: text('nivel_confianza', {
      enum: ['confirmado', 'alto', 'medio', 'bajo'],
    }).notNull(),
    esOficial: integer('es_oficial', { mode: 'boolean' }).notNull().default(true),
    resultado: text('resultado', { enum: ['afirmativa', 'negativa'] }),
    fuentePrincipalId: integer('fuente_principal_id').references(() => fuentes.id),
  },
  (table) => ({
    porSesion: index('idx_votaciones_sesion').on(table.sesionId),
    porAsunto: index('idx_votaciones_asunto').on(table.asuntoId),
  }),
)

export const resultadosAgregados = sqliteTable(
  'resultados_agregados',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    votacionId: integer('votacion_id')
      .notNull()
      .references(() => votaciones.id),
    afirmativos: integer('afirmativos'),
    negativos: integer('negativos'),
    abstenciones: integer('abstenciones'),
    totalPresentes: integer('total_presentes'),
    totalMiembros: integer('total_miembros'),
    unanimidad: integer('unanimidad', { mode: 'boolean' }),
    resultado: text('resultado', { enum: ['afirmativa', 'negativa'] }),
  },
  (table) => ({
    porVotacion: uniqueIndex('uidx_resultados_agregados_votacion').on(table.votacionId),
  }),
)

export const votosIndividuales = sqliteTable(
  'votos_individuales',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    votacionId: integer('votacion_id')
      .notNull()
      .references(() => votaciones.id),
    legisladorId: integer('legislador_id')
      .notNull()
      .references(() => legisladores.id),
    voto: text('voto', {
      enum: ['afirmativo', 'negativo', 'abstencion', 'ausente', 'sin_emitir'],
    }).notNull(),
    nivelConfianza: text('nivel_confianza', {
      enum: ['confirmado', 'alto', 'medio', 'bajo'],
    }).notNull(),
    esOficial: integer('es_oficial', { mode: 'boolean' }).notNull().default(true),
    fuenteId: integer('fuente_id').references(() => fuentes.id),
  },
  (table) => ({
    porLegislador: index('idx_votos_individuales_legislador').on(table.legisladorId),
    porVotacion: index('idx_votos_individuales_votacion').on(table.votacionId),
    unicoPorVotacion: uniqueIndex('uidx_votos_individuales_vot_leg').on(
      table.votacionId,
      table.legisladorId,
    ),
  }),
)

export const evidencias = sqliteTable('evidencias', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fuenteId: integer('fuente_id')
    .notNull()
    .references(() => fuentes.id),
  votacionId: integer('votacion_id').references(() => votaciones.id),
  votoIndividualId: integer('voto_individual_id').references(() => votosIndividuales.id),
  tipo: text('tipo', { enum: ['texto', 'timestamp', 'ocr', 'nota'] }).notNull(),
  texto: text('texto'),
  timestampInicio: integer('timestamp_inicio'),
  timestampFin: integer('timestamp_fin'),
  detalle: text('detalle'),
})

export const partidosRelations = relations(partidos, ({ many }) => ({
  legisladores: many(legisladores),
}))

export const legisladoresRelations = relations(legisladores, ({ one, many }) => ({
  partido: one(partidos, {
    fields: [legisladores.partidoId],
    references: [partidos.id],
  }),
  titular: one(legisladores, {
    fields: [legisladores.titularId],
    references: [legisladores.id],
    relationName: 'suplente_titular',
  }),
  suplentes: many(legisladores, { relationName: 'suplente_titular' }),
  votosIndividuales: many(votosIndividuales),
}))

export const legislaturasRelations = relations(legislaturas, ({ many }) => ({
  sesiones: many(sesiones),
}))

export const fuentesRelations = relations(fuentes, ({ many }) => ({
  sesiones: many(sesiones),
  votacionesPrincipales: many(votaciones),
  votosIndividuales: many(votosIndividuales),
  evidencias: many(evidencias),
}))

export const sesionesRelations = relations(sesiones, ({ one, many }) => ({
  legislatura: one(legislaturas, {
    fields: [sesiones.legislaturaId],
    references: [legislaturas.id],
  }),
  fuente: one(fuentes, {
    fields: [sesiones.fuenteId],
    references: [fuentes.id],
  }),
  votaciones: many(votaciones),
}))

export const asuntosRelations = relations(asuntos, ({ many }) => ({
  votaciones: many(votaciones),
}))

export const votacionesRelations = relations(votaciones, ({ one, many }) => ({
  sesion: one(sesiones, {
    fields: [votaciones.sesionId],
    references: [sesiones.id],
  }),
  asunto: one(asuntos, {
    fields: [votaciones.asuntoId],
    references: [asuntos.id],
  }),
  fuentePrincipal: one(fuentes, {
    fields: [votaciones.fuentePrincipalId],
    references: [fuentes.id],
  }),
  resultadoAgregado: one(resultadosAgregados, {
    fields: [votaciones.id],
    references: [resultadosAgregados.votacionId],
  }),
  votosIndividuales: many(votosIndividuales),
  evidencias: many(evidencias),
}))

export const resultadosAgregadosRelations = relations(
  resultadosAgregados,
  ({ one }) => ({
    votacion: one(votaciones, {
      fields: [resultadosAgregados.votacionId],
      references: [votaciones.id],
    }),
  }),
)

export const votosIndividualesRelations = relations(
  votosIndividuales,
  ({ one, many }) => ({
    votacion: one(votaciones, {
      fields: [votosIndividuales.votacionId],
      references: [votaciones.id],
    }),
    legislador: one(legisladores, {
      fields: [votosIndividuales.legisladorId],
      references: [legisladores.id],
    }),
    fuente: one(fuentes, {
      fields: [votosIndividuales.fuenteId],
      references: [fuentes.id],
    }),
    evidencias: many(evidencias),
  }),
)

export const evidenciasRelations = relations(evidencias, ({ one }) => ({
  fuente: one(fuentes, {
    fields: [evidencias.fuenteId],
    references: [fuentes.id],
  }),
  votacion: one(votaciones, {
    fields: [evidencias.votacionId],
    references: [votaciones.id],
  }),
  votoIndividual: one(votosIndividuales, {
    fields: [evidencias.votoIndividualId],
    references: [votosIndividuales.id],
  }),
}))
