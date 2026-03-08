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
  const partidoCA = db.select().from(partidos).where(eq(partidos.sigla, 'CA')).get()!

  // 3 legisladores del FA
  const fa1 = db
    .insert(legisladores)
    .values({ nombre: 'FA Legislador 1', partidoId: partidoFA.id, camara: 'senado' })
    .returning()
    .get()
  const fa2 = db
    .insert(legisladores)
    .values({ nombre: 'FA Legislador 2', partidoId: partidoFA.id, camara: 'senado' })
    .returning()
    .get()
  const fa3 = db
    .insert(legisladores)
    .values({ nombre: 'FA Legislador 3', partidoId: partidoFA.id, camara: 'senado' })
    .returning()
    .get()

  // 2 legisladores del PN
  const pn1 = db
    .insert(legisladores)
    .values({ nombre: 'PN Legislador 1', partidoId: partidoPN.id, camara: 'senado' })
    .returning()
    .get()
  const pn2 = db
    .insert(legisladores)
    .values({ nombre: 'PN Legislador 2', partidoId: partidoPN.id, camara: 'senado' })
    .returning()
    .get()

  // 1 legislador de CA
  const ca1 = db
    .insert(legisladores)
    .values({ nombre: 'CA Legislador 1', partidoId: partidoCA.id, camara: 'senado' })
    .returning()
    .get()

  const leg50 = db.select().from(legislaturas).where(eq(legislaturas.numero, 50)).get()!

  const sesion = db
    .insert(sesiones)
    .values({ legislaturaId: leg50.id, camara: 'senado', fecha: '2025-05-01', numero: 1 })
    .returning()
    .get()

  const proyecto = db
    .insert(proyectosLey)
    .values({ nombre: 'Ley de reforma tributaria', sesionId: sesion.id })
    .returning()
    .get()

  // FA: 2 afirmativo, 1 negativo
  db.insert(votos)
    .values([
      { proyectoLeyId: proyecto.id, legisladorId: fa1.id, voto: 'afirmativo' },
      { proyectoLeyId: proyecto.id, legisladorId: fa2.id, voto: 'afirmativo' },
      { proyectoLeyId: proyecto.id, legisladorId: fa3.id, voto: 'negativo' },
    ])
    .run()

  // PN: 1 negativo, 1 ausente
  db.insert(votos)
    .values([
      { proyectoLeyId: proyecto.id, legisladorId: pn1.id, voto: 'negativo' },
      { proyectoLeyId: proyecto.id, legisladorId: pn2.id, voto: 'ausente' },
    ])
    .run()

  // CA: 1 afirmativo
  db.insert(votos)
    .values([
      { proyectoLeyId: proyecto.id, legisladorId: ca1.id, voto: 'afirmativo' },
    ])
    .run()

  return { proyecto, partidoFA, partidoPN, partidoCA }
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

describe('consulta de votos por proyecto de ley', () => {
  it('retorna todos los votos de un proyecto', () => {
    const datos = crearDatosPrueba()

    const votosProyecto = sqlite
      .prepare(`SELECT * FROM votos WHERE proyecto_ley_id = ?`)
      .all(datos.proyecto.id)

    expect(votosProyecto).toHaveLength(6)
  })

  it('agrupa votos por partido correctamente', () => {
    const datos = crearDatosPrueba()

    const porPartido = sqlite
      .prepare(
        `SELECT pa.sigla, pa.nombre as partido,
           SUM(CASE WHEN v.voto = 'afirmativo' THEN 1 ELSE 0 END) as afirmativos,
           SUM(CASE WHEN v.voto = 'negativo' THEN 1 ELSE 0 END) as negativos,
           SUM(CASE WHEN v.voto = 'ausente' THEN 1 ELSE 0 END) as ausentes,
           COUNT(*) as total
         FROM votos v
         JOIN legisladores l ON v.legislador_id = l.id
         JOIN partidos pa ON l.partido_id = pa.id
         WHERE v.proyecto_ley_id = ?
         GROUP BY pa.id
         ORDER BY pa.sigla`,
      )
      .all(datos.proyecto.id) as {
      sigla: string
      partido: string
      afirmativos: number
      negativos: number
      ausentes: number
      total: number
    }[]

    expect(porPartido).toHaveLength(3)

    // CA: 1 afirmativo
    const ca = porPartido.find((p) => p.sigla === 'CA')!
    expect(ca.afirmativos).toBe(1)
    expect(ca.negativos).toBe(0)
    expect(ca.total).toBe(1)

    // FA: 2 afirmativo, 1 negativo
    const fa = porPartido.find((p) => p.sigla === 'FA')!
    expect(fa.afirmativos).toBe(2)
    expect(fa.negativos).toBe(1)
    expect(fa.total).toBe(3)

    // PN: 1 negativo, 1 ausente
    const pn = porPartido.find((p) => p.sigla === 'PN')!
    expect(pn.negativos).toBe(1)
    expect(pn.ausentes).toBe(1)
    expect(pn.total).toBe(2)
  })

  it('calcula el resumen general del proyecto', () => {
    const datos = crearDatosPrueba()

    const resumen = sqlite
      .prepare(
        `SELECT
           p.nombre,
           SUM(CASE WHEN v.voto = 'afirmativo' THEN 1 ELSE 0 END) as afirmativos,
           SUM(CASE WHEN v.voto = 'negativo' THEN 1 ELSE 0 END) as negativos,
           SUM(CASE WHEN v.voto = 'ausente' THEN 1 ELSE 0 END) as ausentes,
           COUNT(v.id) as total
         FROM proyectos_ley p
         LEFT JOIN votos v ON v.proyecto_ley_id = p.id
         WHERE p.id = ?
         GROUP BY p.id`,
      )
      .get(datos.proyecto.id) as {
      nombre: string
      afirmativos: number
      negativos: number
      ausentes: number
      total: number
    }

    expect(resumen.nombre).toBe('Ley de reforma tributaria')
    expect(resumen.afirmativos).toBe(3) // FA: 2 + CA: 1
    expect(resumen.negativos).toBe(2) // FA: 1 + PN: 1
    expect(resumen.ausentes).toBe(1) // PN: 1
    expect(resumen.total).toBe(6)
  })

  it('un proyecto sin votos retorna conteo cero', () => {
    crearDatosPrueba()

    const leg50 = db.select().from(legislaturas).where(eq(legislaturas.numero, 50)).get()!
    const sesion = db.select().from(sesiones).get()!

    const proyectoVacio = db
      .insert(proyectosLey)
      .values({ nombre: 'Proyecto sin votos', sesionId: sesion.id })
      .returning()
      .get()

    const votosProyecto = sqlite
      .prepare(`SELECT * FROM votos WHERE proyecto_ley_id = ?`)
      .all(proyectoVacio.id)

    expect(votosProyecto).toHaveLength(0)
  })

  it('consulta votos por proyecto con fecha de sesión', () => {
    const datos = crearDatosPrueba()

    const conFecha = sqlite
      .prepare(
        `SELECT p.nombre, s.fecha, s.camara, COUNT(v.id) as total_votos
         FROM proyectos_ley p
         JOIN sesiones s ON p.sesion_id = s.id
         LEFT JOIN votos v ON v.proyecto_ley_id = p.id
         WHERE p.id = ?
         GROUP BY p.id`,
      )
      .get(datos.proyecto.id) as {
      nombre: string
      fecha: string
      camara: string
      total_votos: number
    }

    expect(conFecha.nombre).toBe('Ley de reforma tributaria')
    expect(conFecha.fecha).toBe('2025-05-01')
    expect(conFecha.camara).toBe('senado')
    expect(conFecha.total_votos).toBe(6)
  })
})
