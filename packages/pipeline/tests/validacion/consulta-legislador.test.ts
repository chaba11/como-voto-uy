import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  partidos,
  legisladores,
  legislaturas,
  sesiones,
  proyectosLey,
  votos,
} from '@como-voto-uy/shared'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { seedPartidos } from '../../src/seed/partidos.js'
import { seedLegislaturas } from '../../src/seed/legislaturas.js'
import type { DB } from '../../src/db/conexion.js'

let db: DB
let sqlite: ReturnType<typeof crearConexionEnMemoria>['sqlite']

function crearDatosPrueba() {
  const partidoFA = db.select().from(partidos).where(eq(partidos.sigla, 'FA')).get()!
  const partidoPN = db.select().from(partidos).where(eq(partidos.sigla, 'PN')).get()!

  const legislador1 = db
    .insert(legisladores)
    .values({ nombre: 'Ana Rodríguez', partidoId: partidoFA.id, camara: 'senado' })
    .returning()
    .get()

  const legislador2 = db
    .insert(legisladores)
    .values({ nombre: 'Pedro Sánchez', partidoId: partidoPN.id, camara: 'senado' })
    .returning()
    .get()

  const leg50 = db.select().from(legislaturas).where(eq(legislaturas.numero, 50)).get()!

  const sesion1 = db
    .insert(sesiones)
    .values({ legislaturaId: leg50.id, camara: 'senado', fecha: '2025-04-01', numero: 1 })
    .returning()
    .get()

  const sesion2 = db
    .insert(sesiones)
    .values({ legislaturaId: leg50.id, camara: 'senado', fecha: '2025-04-15', numero: 2 })
    .returning()
    .get()

  const proyecto1 = db
    .insert(proyectosLey)
    .values({ nombre: 'Ley de presupuesto', sesionId: sesion1.id })
    .returning()
    .get()

  const proyecto2 = db
    .insert(proyectosLey)
    .values({ nombre: 'Ley de educación', sesionId: sesion1.id })
    .returning()
    .get()

  const proyecto3 = db
    .insert(proyectosLey)
    .values({ nombre: 'Ley de salud', sesionId: sesion2.id })
    .returning()
    .get()

  // Legislador 1 vota en los 3 proyectos
  db.insert(votos)
    .values([
      { proyectoLeyId: proyecto1.id, legisladorId: legislador1.id, voto: 'afirmativo' },
      { proyectoLeyId: proyecto2.id, legisladorId: legislador1.id, voto: 'negativo' },
      { proyectoLeyId: proyecto3.id, legisladorId: legislador1.id, voto: 'afirmativo' },
    ])
    .run()

  // Legislador 2 vota en 2 proyectos
  db.insert(votos)
    .values([
      { proyectoLeyId: proyecto1.id, legisladorId: legislador2.id, voto: 'negativo' },
      { proyectoLeyId: proyecto3.id, legisladorId: legislador2.id, voto: 'afirmativo' },
    ])
    .run()

  return { legislador1, legislador2, proyecto1, proyecto2, proyecto3 }
}

beforeEach(() => {
  const conexion = crearConexionEnMemoria()
  db = conexion.db
  sqlite = conexion.sqlite
  pushearSchema(sqlite)
  seedPartidos(db)
  seedLegislaturas(db)
})

afterEach(() => {
  sqlite.close()
})

describe('consulta de votos por legislador', () => {
  it('retorna todos los votos de un legislador específico', () => {
    const datos = crearDatosPrueba()

    const votosLeg = sqlite
      .prepare(
        `SELECT v.voto, p.nombre as proyecto
         FROM votos v
         JOIN proyectos_ley p ON v.proyecto_ley_id = p.id
         WHERE v.legislador_id = ?
         ORDER BY p.nombre`,
      )
      .all(datos.legislador1.id) as { voto: string; proyecto: string }[]

    expect(votosLeg).toHaveLength(3)
    expect(votosLeg.map((v) => v.proyecto)).toContain('Ley de presupuesto')
    expect(votosLeg.map((v) => v.proyecto)).toContain('Ley de educación')
    expect(votosLeg.map((v) => v.proyecto)).toContain('Ley de salud')
  })

  it('cuenta correctamente votos afirmativos y negativos', () => {
    const datos = crearDatosPrueba()

    const resumen = sqlite
      .prepare(
        `SELECT
           SUM(CASE WHEN voto = 'afirmativo' THEN 1 ELSE 0 END) as afirmativos,
           SUM(CASE WHEN voto = 'negativo' THEN 1 ELSE 0 END) as negativos,
           COUNT(*) as total
         FROM votos
         WHERE legislador_id = ?`,
      )
      .get(datos.legislador1.id) as {
      afirmativos: number
      negativos: number
      total: number
    }

    expect(resumen.total).toBe(3)
    expect(resumen.afirmativos).toBe(2)
    expect(resumen.negativos).toBe(1)
  })

  it('retorna los votos con información del partido', () => {
    const datos = crearDatosPrueba()

    const votosConPartido = sqlite
      .prepare(
        `SELECT v.voto, p.nombre as proyecto, pa.sigla as partido
         FROM votos v
         JOIN proyectos_ley p ON v.proyecto_ley_id = p.id
         JOIN legisladores l ON v.legislador_id = l.id
         JOIN partidos pa ON l.partido_id = pa.id
         WHERE v.legislador_id = ?`,
      )
      .all(datos.legislador1.id) as { voto: string; proyecto: string; partido: string }[]

    expect(votosConPartido).toHaveLength(3)
    for (const v of votosConPartido) {
      expect(v.partido).toBe('FA')
    }
  })

  it('un legislador sin votos retorna lista vacía', () => {
    crearDatosPrueba()

    // Insertar un legislador sin votos
    const partidoFA = db.select().from(partidos).where(eq(partidos.sigla, 'FA')).get()!
    const legSinVotos = db
      .insert(legisladores)
      .values({ nombre: 'Sin Votos', partidoId: partidoFA.id, camara: 'senado' })
      .returning()
      .get()

    const votosLeg = sqlite
      .prepare(`SELECT * FROM votos WHERE legislador_id = ?`)
      .all(legSinVotos.id)

    expect(votosLeg).toHaveLength(0)
  })
})
