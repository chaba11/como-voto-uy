import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { legisladores, legislaturas, partidos } from '@como-voto-uy/shared'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { seedLegislaturas } from '../../src/seed/legislaturas.js'
import { seedPartidos } from '../../src/seed/partidos.js'
import {
  PARTIDO_POR_DIPUTADO,
  extraerLegisladoresUnicos,
  reconciliarLegisladoresSinAsignar,
  seedLegisladoresRepresentantes,
} from '../../src/seed/legisladores-representantes.js'
import type { VotacionRepresentantes } from '../../src/scraper/votaciones-representantes.js'

function crearVotacion(listaSi: string[], listaNo: string[]): VotacionRepresentantes {
  return {
    Sesion: 1,
    SesionFecha: '2025-03-15',
    Votacion: 'Test',
    Tipo: 'Nominal',
    SiVoto: String(listaSi.length),
    NoVoto: String(listaNo.length),
    Lista_Si: listaSi,
    Lista_No: listaNo,
  }
}

describe('legisladores representantes', () => {
  describe('extraerLegisladoresUnicos', () => {
    it('extrae nombres únicos de votaciones', () => {
      const nombres = extraerLegisladoresUnicos([
        crearVotacion(['Abdala, Pablo D.', 'Gandini, Jorge A.'], ['Bottino, Valentina']),
        crearVotacion(['Malan, Juan Martín'], ['Abdala, Pablo D.']),
      ])

      expect(nombres).toEqual([
        'Abdala, Pablo D.',
        'Bottino, Valentina',
        'Gandini, Jorge A.',
        'Malan, Juan Martín',
      ])
    })
  })

  describe('seedLegisladoresRepresentantes', () => {
    it('inserta legisladores con partido resuelto por padrón', async () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)
      seedPartidos(db)
      seedLegislaturas(db)

      const insertados = await seedLegisladoresRepresentantes(
        db,
        [crearVotacion(['Abdala, Pablo D.'], ['Gandini, Jorge A.'])],
        [
          { nombre: 'Abdala, Pablo D.', siglaPartido: 'FA' },
          { nombre: 'Gandini, Jorge A.', siglaPartido: 'PN' },
        ],
      )

      expect(insertados).toBe(2)
      const todos = db.select().from(legisladores).all()
      expect(todos).toHaveLength(2)
      expect(todos.every((legislador) => legislador.camara === 'representantes')).toBe(true)
      expect(todos.every((legislador) => legislador.origenPartido === 'padron')).toBe(true)
    })

    it('usa Sin asignar como último fallback', async () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)
      seedPartidos(db)
      seedLegislaturas(db)

      await seedLegisladoresRepresentantes(db, [
        crearVotacion(['Desconocido, Juan'], []),
      ])

      const desconocido = db
        .select()
        .from(legisladores)
        .where(eq(legisladores.nombre, 'Desconocido, Juan'))
        .get()

      const sinAsignar = db
        .select()
        .from(partidos)
        .where(eq(partidos.sigla, 'SA'))
        .get()

      expect(desconocido).toBeDefined()
      expect(sinAsignar).toBeDefined()
      expect(desconocido?.partidoId).toBe(sinAsignar?.id)
      expect(desconocido?.origenPartido).toBe('sin_asignar')
    })

    it('reconcilia un Sin asignar cuando aparece un par fuerte', async () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)
      seedPartidos(db)
      seedLegislaturas(db)

      const legislaturaId = db
        .select()
        .from(legislaturas)
        .where(eq(legislaturas.numero, 50))
        .get()!.id

      const partidoFa = db.select().from(partidos).where(eq(partidos.sigla, 'FA')).get()!
      const partidoSa = db.select().from(partidos).where(eq(partidos.sigla, 'SA')).get()!

      db.insert(legisladores)
        .values([
          {
            nombre: 'Abdala, Pablo D.',
            legislaturaId,
            partidoId: partidoSa.id,
            camara: 'representantes',
            origenPartido: 'sin_asignar',
          },
          {
            nombre: 'Pablo Abdala',
            legislaturaId,
            partidoId: partidoFa.id,
            camara: 'representantes',
            origenPartido: 'padron',
          },
        ])
        .run()

      const reconciliados = reconciliarLegisladoresSinAsignar(db, legislaturaId)
      const abdala = db
        .select()
        .from(legisladores)
        .where(eq(legisladores.nombre, 'Abdala, Pablo D.'))
        .get()

      expect(reconciliados).toBe(1)
      expect(abdala?.partidoId).toBe(partidoFa.id)
      expect(abdala?.origenPartido).toBe('inferido')
    })
  })

  it('mantiene exportado el fallback manual', () => {
    expect(PARTIDO_POR_DIPUTADO['Abdala, Pablo D.']).toBe('FA')
  })
})
