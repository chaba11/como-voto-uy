import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const partidos = sqliteTable('partidos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  sigla: text('sigla').notNull(),
  color: text('color').notNull(),
})

export const legisladores = sqliteTable('legisladores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  partidoId: integer('partido_id')
    .notNull()
    .references(() => partidos.id),
  titularId: integer('titular_id'),
  camara: text('camara', { enum: ['senado', 'representantes'] }).notNull(),
  departamento: text('departamento'),
})

export const legislaturas = sqliteTable('legislaturas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  numero: integer('numero').notNull().unique(),
  fechaInicio: text('fecha_inicio').notNull(),
  fechaFin: text('fecha_fin'),
})

export const sesiones = sqliteTable('sesiones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  legislaturaId: integer('legislatura_id')
    .notNull()
    .references(() => legislaturas.id),
  camara: text('camara', { enum: ['senado', 'representantes'] }).notNull(),
  fecha: text('fecha').notNull(),
  numero: integer('numero'),
  urlTaquigrafica: text('url_taquigrafica'),
})

export const proyectosLey = sqliteTable('proyectos_ley', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  tema: text('tema'),
  sesionId: integer('sesion_id')
    .notNull()
    .references(() => sesiones.id),
})

export const votos = sqliteTable('votos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  proyectoLeyId: integer('proyecto_ley_id')
    .notNull()
    .references(() => proyectosLey.id),
  legisladorId: integer('legislador_id')
    .notNull()
    .references(() => legisladores.id),
  voto: text('voto', { enum: ['afirmativo', 'negativo', 'ausente'] }).notNull(),
})

// Relations

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
  votos: many(votos),
}))

export const legislaturasRelations = relations(legislaturas, ({ many }) => ({
  sesiones: many(sesiones),
}))

export const sesionesRelations = relations(sesiones, ({ one, many }) => ({
  legislatura: one(legislaturas, {
    fields: [sesiones.legislaturaId],
    references: [legislaturas.id],
  }),
  proyectosLey: many(proyectosLey),
}))

export const proyectosLeyRelations = relations(proyectosLey, ({ one, many }) => ({
  sesion: one(sesiones, {
    fields: [proyectosLey.sesionId],
    references: [sesiones.id],
  }),
  votos: many(votos),
}))

export const votosRelations = relations(votos, ({ one }) => ({
  proyectoLey: one(proyectosLey, {
    fields: [votos.proyectoLeyId],
    references: [proyectosLey.id],
  }),
  legislador: one(legisladores, {
    fields: [votos.legisladorId],
    references: [legisladores.id],
  }),
}))
