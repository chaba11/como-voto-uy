import { describe, it, expect } from 'vitest'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { seedPartidos } from '../../src/seed/partidos.js'
import {
  extraerLegisladoresUnicos,
  seedLegisladoresRepresentantes,
  PARTIDO_POR_DIPUTADO,
} from '../../src/seed/legisladores-representantes.js'
import { legisladores, partidos } from '@como-voto-uy/shared'
import { eq } from 'drizzle-orm'
import type { VotacionRepresentantes } from '../../src/scraper/votaciones-representantes.js'

function crearVotacion(
  listaSi: string[],
  listaNo: string[],
): VotacionRepresentantes {
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
      const votaciones = [
        crearVotacion(['Abdala, Pablo D.', 'Gandini, Jorge A.'], ['Bottino, Valentina']),
        crearVotacion(['Malan, Juan Martín'], ['Abdala, Pablo D.']),
      ]

      const nombres = extraerLegisladoresUnicos(votaciones)

      expect(nombres).toHaveLength(4)
      expect(nombres).toContain('Abdala, Pablo D.')
      expect(nombres).toContain('Gandini, Jorge A.')
      expect(nombres).toContain('Bottino, Valentina')
      expect(nombres).toContain('Malan, Juan Martín')
    })

    it('elimina duplicados entre votaciones', () => {
      const votaciones = [
        crearVotacion(['Abdala, Pablo D.'], ['Gandini, Jorge A.']),
        crearVotacion(['Abdala, Pablo D.'], ['Gandini, Jorge A.']),
      ]

      const nombres = extraerLegisladoresUnicos(votaciones)
      expect(nombres).toHaveLength(2)
    })

    it('retorna nombres ordenados alfabéticamente', () => {
      const votaciones = [
        crearVotacion(['Malan, Juan Martín', 'Abdala, Pablo D.'], ['Gandini, Jorge A.']),
      ]

      const nombres = extraerLegisladoresUnicos(votaciones)
      expect(nombres).toEqual([
        'Abdala, Pablo D.',
        'Gandini, Jorge A.',
        'Malan, Juan Martín',
      ])
    })

    it('recorta espacios en los nombres', () => {
      const votaciones = [
        crearVotacion([' Abdala, Pablo D. '], []),
      ]

      const nombres = extraerLegisladoresUnicos(votaciones)
      expect(nombres).toEqual(['Abdala, Pablo D.'])
    })

    it('retorna lista vacía si no hay votaciones', () => {
      expect(extraerLegisladoresUnicos([])).toEqual([])
    })
  })

  describe('seedLegisladoresRepresentantes', () => {
    it('inserta legisladores con partido conocido', async () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)
      seedPartidos(db)

      const votaciones = [
        crearVotacion(['Abdala, Pablo D.'], ['Gandini, Jorge A.']),
      ]

      const insertados = await seedLegisladoresRepresentantes(db, votaciones)

      expect(insertados).toBe(2)

      const todos = db.select().from(legisladores).all()
      expect(todos).toHaveLength(2)
      expect(todos.every((l) => l.camara === 'representantes')).toBe(true)
    })

    it('inserta legisladores sin partido conocido con "Sin asignar"', async () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)
      seedPartidos(db)

      const votaciones = [
        crearVotacion(['Abdala, Pablo D.', 'Desconocido, Juan'], ['Gandini, Jorge A.']),
      ]

      const insertados = await seedLegisladoresRepresentantes(db, votaciones)

      // Ahora se insertan los 3 (el desconocido con partido "Sin asignar")
      expect(insertados).toBe(3)

      const todos = db.select().from(legisladores).all()
      expect(todos).toHaveLength(3)

      // Verificar que "Desconocido" tiene partido "Sin asignar"
      const desconocido = todos.find((l) => l.nombre === 'Desconocido, Juan')
      expect(desconocido).toBeDefined()
      const sinAsignar = db
        .select()
        .from(partidos)
        .where(eq(partidos.sigla, 'SA'))
        .get()
      expect(sinAsignar).toBeDefined()
      expect(desconocido!.partidoId).toBe(sinAsignar!.id)
    })

    it('no duplica legisladores al ejecutar dos veces', async () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)
      seedPartidos(db)

      const votaciones = [
        crearVotacion(['Abdala, Pablo D.'], ['Gandini, Jorge A.']),
      ]

      await seedLegisladoresRepresentantes(db, votaciones)
      const insertados2 = await seedLegisladoresRepresentantes(db, votaciones)

      expect(insertados2).toBe(0)

      const todos = db.select().from(legisladores).all()
      expect(todos).toHaveLength(2)
    })

    it('retorna 0 si no hay votaciones', async () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)
      seedPartidos(db)

      const insertados = await seedLegisladoresRepresentantes(db, [])
      expect(insertados).toBe(0)
    })
  })
})
