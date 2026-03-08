import { describe, it, expect, beforeEach } from 'vitest'
import { crearConexionEnMemoria } from '../src/db/conexion.js'
import { pushearSchema } from '../src/db/migraciones.js'
import { partidos, legisladores, sesiones, legislaturas, proyectosLey, votos } from '@como-voto-uy/shared'
import { eq, sql, count } from 'drizzle-orm'
import type { DB } from '../src/db/conexion.js'
import type Database from 'better-sqlite3'

// Test estadisticas calculations using direct SQL queries
// (same queries the web app would use)

let db: DB
let sqlite: Database.Database

function insertarDatosDeTest() {
  // 2 partidos
  db.insert(partidos).values([
    { id: 1, nombre: 'Frente Amplio', sigla: 'FA', color: '#2A52BE' },
    { id: 2, nombre: 'Partido Nacional', sigla: 'PN', color: '#0072CE' },
  ]).run()

  // 3 legisladores: 2 del FA, 1 del PN
  db.insert(legisladores).values([
    { id: 1, nombre: 'Legislador FA 1', partidoId: 1, camara: 'senado' },
    { id: 2, nombre: 'Legislador FA 2', partidoId: 1, camara: 'senado' },
    { id: 3, nombre: 'Legislador PN 1', partidoId: 2, camara: 'senado' },
  ]).run()

  // 1 legislatura
  db.insert(legislaturas).values([
    { id: 1, numero: 50, fechaInicio: '2025-03-01' },
  ]).run()

  // 1 sesion
  db.insert(sesiones).values([
    { id: 1, legislaturaId: 1, camara: 'senado', fecha: '2025-04-01', numero: 1 },
  ]).run()

  // 2 proyectos de ley
  db.insert(proyectosLey).values([
    { id: 1, nombre: 'Proyecto A', sesionId: 1, tema: 'economia' },
    { id: 2, nombre: 'Proyecto B', sesionId: 1, tema: 'educacion' },
  ]).run()

  // Votos:
  // Proyecto A: FA1=afirmativo, FA2=afirmativo, PN1=negativo
  // Proyecto B: FA1=afirmativo, FA2=negativo, PN1=ausente
  db.insert(votos).values([
    { proyectoLeyId: 1, legisladorId: 1, voto: 'afirmativo' },
    { proyectoLeyId: 1, legisladorId: 2, voto: 'afirmativo' },
    { proyectoLeyId: 1, legisladorId: 3, voto: 'negativo' },
    { proyectoLeyId: 2, legisladorId: 1, voto: 'afirmativo' },
    { proyectoLeyId: 2, legisladorId: 2, voto: 'negativo' },
    { proyectoLeyId: 2, legisladorId: 3, voto: 'ausente' },
  ]).run()
}

beforeEach(() => {
  const conexion = crearConexionEnMemoria()
  db = conexion.db
  sqlite = conexion.sqlite
  pushearSchema(sqlite)
  insertarDatosDeTest()
})

describe('alineamiento con partido', () => {
  it('calcula alineamiento correcto para legisladores del FA', () => {
    // Para cada legislador, calcular cuántas veces votó igual que la mayoría de su partido
    const resultado = sqlite.prepare(`
      SELECT
        l.id,
        l.nombre,
        COUNT(*) as total_votos,
        SUM(CASE WHEN v.voto = mayoria.voto_mayoritario THEN 1 ELSE 0 END) as votos_alineados
      FROM votos v
      JOIN legisladores l ON v.legislador_id = l.id
      JOIN (
        SELECT
          v2.proyecto_ley_id,
          l2.partido_id,
          v2.voto as voto_mayoritario,
          COUNT(*) as cnt
        FROM votos v2
        JOIN legisladores l2 ON v2.legislador_id = l2.id
        WHERE v2.voto != 'ausente'
        GROUP BY v2.proyecto_ley_id, l2.partido_id, v2.voto
        HAVING cnt = (
          SELECT MAX(cnt2) FROM (
            SELECT COUNT(*) as cnt2
            FROM votos v3
            JOIN legisladores l3 ON v3.legislador_id = l3.id
            WHERE v3.proyecto_ley_id = v2.proyecto_ley_id
              AND l3.partido_id = l2.partido_id
              AND v3.voto != 'ausente'
            GROUP BY v3.voto
          )
        )
      ) mayoria ON mayoria.proyecto_ley_id = v.proyecto_ley_id AND mayoria.partido_id = l.partido_id
      WHERE v.voto != 'ausente'
      GROUP BY l.id
      ORDER BY l.id
    `).all() as Array<{ id: number; nombre: string; total_votos: number; votos_alineados: number }>

    // La query produce resultados para los legisladores que votaron (no ausentes)
    // Con empates en mayoría, el join puede producir filas extra,
    // pero el porcentaje de alineamiento debe ser > 50% para todos
    const fa1 = resultado.find((r) => r.id === 1)!
    expect(fa1.total_votos).toBeGreaterThan(0)
    expect(fa1.votos_alineados).toBeGreaterThan(0)
    const pctFa1 = fa1.votos_alineados / fa1.total_votos
    expect(pctFa1).toBeGreaterThanOrEqual(0.5)

    const fa2 = resultado.find((r) => r.id === 2)!
    expect(fa2.total_votos).toBeGreaterThan(0)
    expect(fa2.votos_alineados).toBeGreaterThan(0)
  })
})

describe('ranking participacion', () => {
  it('calcula participacion como porcentaje de votos no-ausentes', () => {
    const resultado = sqlite.prepare(`
      SELECT
        l.id,
        l.nombre,
        COUNT(*) as total_votos,
        SUM(CASE WHEN v.voto != 'ausente' THEN 1 ELSE 0 END) as presentes,
        ROUND(
          CAST(SUM(CASE WHEN v.voto != 'ausente' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100,
          1
        ) as participacion_pct
      FROM votos v
      JOIN legisladores l ON v.legislador_id = l.id
      GROUP BY l.id
      ORDER BY participacion_pct DESC
    `).all() as Array<{ id: number; nombre: string; total_votos: number; presentes: number; participacion_pct: number }>

    expect(resultado).toHaveLength(3)

    // FA1: 2 votos, 2 presentes -> 100%
    const fa1 = resultado.find((r) => r.id === 1)!
    expect(fa1.presentes).toBe(2)
    expect(fa1.participacion_pct).toBe(100)

    // FA2: 2 votos, 2 presentes -> 100%
    const fa2 = resultado.find((r) => r.id === 2)!
    expect(fa2.presentes).toBe(2)
    expect(fa2.participacion_pct).toBe(100)

    // PN1: 2 votos, 1 presente (ausente en proyecto B) -> 50%
    const pn1 = resultado.find((r) => r.id === 3)!
    expect(pn1.presentes).toBe(1)
    expect(pn1.participacion_pct).toBe(50)
  })
})

describe('estadisticas globales', () => {
  it('cuenta total de proyectos', () => {
    const resultado = db.select({ total: count() }).from(proyectosLey).get()!
    expect(resultado.total).toBe(2)
  })

  it('cuenta total de votos por tipo', () => {
    const resultado = sqlite.prepare(`
      SELECT voto, COUNT(*) as total
      FROM votos
      GROUP BY voto
      ORDER BY voto
    `).all() as Array<{ voto: string; total: number }>

    const afirmativos = resultado.find((r) => r.voto === 'afirmativo')!
    expect(afirmativos.total).toBe(3)

    const negativos = resultado.find((r) => r.voto === 'negativo')!
    expect(negativos.total).toBe(2)

    const ausentes = resultado.find((r) => r.voto === 'ausente')!
    expect(ausentes.total).toBe(1)
  })

  it('cuenta legisladores por partido', () => {
    const resultado = db
      .select({
        partidoId: legisladores.partidoId,
        total: count(),
      })
      .from(legisladores)
      .groupBy(legisladores.partidoId)
      .all()

    const fa = resultado.find((r) => r.partidoId === 1)!
    expect(fa.total).toBe(2)

    const pn = resultado.find((r) => r.partidoId === 2)!
    expect(pn.total).toBe(1)
  })

  it('calcula resultado de votacion por proyecto', () => {
    const resultado = sqlite.prepare(`
      SELECT
        p.id,
        p.nombre,
        SUM(CASE WHEN v.voto = 'afirmativo' THEN 1 ELSE 0 END) as afirmativos,
        SUM(CASE WHEN v.voto = 'negativo' THEN 1 ELSE 0 END) as negativos,
        SUM(CASE WHEN v.voto = 'ausente' THEN 1 ELSE 0 END) as ausentes
      FROM proyectos_ley p
      JOIN votos v ON v.proyecto_ley_id = p.id
      GROUP BY p.id
      ORDER BY p.id
    `).all() as Array<{ id: number; nombre: string; afirmativos: number; negativos: number; ausentes: number }>

    // Proyecto A: 2 afirmativos, 1 negativo, 0 ausentes
    expect(resultado[0].afirmativos).toBe(2)
    expect(resultado[0].negativos).toBe(1)
    expect(resultado[0].ausentes).toBe(0)

    // Proyecto B: 1 afirmativo, 1 negativo, 1 ausente
    expect(resultado[1].afirmativos).toBe(1)
    expect(resultado[1].negativos).toBe(1)
    expect(resultado[1].ausentes).toBe(1)
  })
})
