import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import {
  partidos,
  legisladores,
  legislaturas,
  sesiones,
  proyectosLey,
  votos,
  MIEMBROS_POR_CAMARA,
} from '@como-voto-uy/shared'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { seedPartidos } from '../../src/seed/partidos.js'
import { seedLegislaturas } from '../../src/seed/legislaturas.js'
import type { DB } from '../../src/db/conexion.js'

let db: DB
let sqlite: ReturnType<typeof crearConexionEnMemoria>['sqlite']

function insertarDatosPrueba() {
  // Obtener partido FA
  const partidoFA = db
    .select()
    .from(partidos)
    .where(eq(partidos.sigla, 'FA'))
    .get()!

  const partidoPN = db
    .select()
    .from(partidos)
    .where(eq(partidos.sigla, 'PN'))
    .get()!

  // Insertar legisladores
  const leg1 = db
    .insert(legisladores)
    .values({
      nombre: 'Juan Pérez',
      partidoId: partidoFA.id,
      camara: 'senado',
      departamento: 'Montevideo',
    })
    .returning()
    .get()

  const leg2 = db
    .insert(legisladores)
    .values({
      nombre: 'María García',
      partidoId: partidoPN.id,
      camara: 'senado',
      departamento: 'Canelones',
    })
    .returning()
    .get()

  const leg3 = db
    .insert(legisladores)
    .values({
      nombre: 'Carlos López',
      partidoId: partidoFA.id,
      camara: 'senado',
      departamento: 'Montevideo',
      titularId: leg1.id,
    })
    .returning()
    .get()

  // Obtener legislatura 50
  const leg50 = db
    .select()
    .from(legislaturas)
    .where(eq(legislaturas.numero, 50))
    .get()!

  // Insertar sesión
  const sesion = db
    .insert(sesiones)
    .values({
      legislaturaId: leg50.id,
      camara: 'senado',
      fecha: '2025-03-15',
      numero: 1,
    })
    .returning()
    .get()

  // Insertar proyecto
  const proyecto = db
    .insert(proyectosLey)
    .values({
      nombre: 'Proyecto de prueba',
      sesionId: sesion.id,
    })
    .returning()
    .get()

  // Insertar votos
  db.insert(votos)
    .values([
      { proyectoLeyId: proyecto.id, legisladorId: leg1.id, voto: 'afirmativo' },
      { proyectoLeyId: proyecto.id, legisladorId: leg2.id, voto: 'negativo' },
    ])
    .run()

  return { partidoFA, partidoPN, leg1, leg2, leg3, leg50, sesion, proyecto }
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

describe('validación de consistencia de datos', () => {
  it('cada voto referencia un legislador que existe', () => {
    insertarDatosPrueba()

    const votosHuerfanos = sqlite
      .prepare(
        `SELECT v.id FROM votos v
         LEFT JOIN legisladores l ON v.legislador_id = l.id
         WHERE l.id IS NULL`,
      )
      .all()

    expect(votosHuerfanos).toHaveLength(0)
  })

  it('cada voto referencia un proyecto_ley que existe', () => {
    insertarDatosPrueba()

    const votosHuerfanos = sqlite
      .prepare(
        `SELECT v.id FROM votos v
         LEFT JOIN proyectos_ley p ON v.proyecto_ley_id = p.id
         WHERE p.id IS NULL`,
      )
      .all()

    expect(votosHuerfanos).toHaveLength(0)
  })

  it('no hay votos duplicados (mismo legislador + proyecto)', () => {
    insertarDatosPrueba()

    const duplicados = sqlite
      .prepare(
        `SELECT legislador_id, proyecto_ley_id, COUNT(*) as n
         FROM votos
         GROUP BY legislador_id, proyecto_ley_id
         HAVING n > 1`,
      )
      .all()

    expect(duplicados).toHaveLength(0)
  })

  it('total de votos por proyecto no excede miembros por cámara', () => {
    const datos = insertarDatosPrueba()

    const conteo = sqlite
      .prepare(
        `SELECT p.id, COUNT(v.id) as total_votos, s.camara
         FROM proyectos_ley p
         JOIN sesiones s ON p.sesion_id = s.id
         LEFT JOIN votos v ON v.proyecto_ley_id = p.id
         GROUP BY p.id`,
      )
      .all() as { id: number; total_votos: number; camara: 'senado' | 'representantes' }[]

    for (const row of conteo) {
      expect(row.total_votos).toBeLessThanOrEqual(
        MIEMBROS_POR_CAMARA[row.camara],
      )
    }
  })

  it('cada suplente con titular_id tiene un titular que existe', () => {
    insertarDatosPrueba()

    const suplentesHuerfanos = sqlite
      .prepare(
        `SELECT l.id FROM legisladores l
         WHERE l.titular_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM legisladores t WHERE t.id = l.titular_id)`,
      )
      .all()

    expect(suplentesHuerfanos).toHaveLength(0)
  })

  it('cada legislador pertenece a un partido existente', () => {
    insertarDatosPrueba()

    const legisladoresHuerfanos = sqlite
      .prepare(
        `SELECT l.id FROM legisladores l
         LEFT JOIN partidos p ON l.partido_id = p.id
         WHERE p.id IS NULL`,
      )
      .all()

    expect(legisladoresHuerfanos).toHaveLength(0)
  })

  it('las fechas de sesión están dentro del rango de su legislatura', () => {
    insertarDatosPrueba()

    const sesionesForaDeFecha = sqlite
      .prepare(
        `SELECT s.id, s.fecha, lg.fecha_inicio, lg.fecha_fin
         FROM sesiones s
         JOIN legislaturas lg ON s.legislatura_id = lg.id
         WHERE s.fecha < lg.fecha_inicio
            OR (lg.fecha_fin IS NOT NULL AND s.fecha > lg.fecha_fin)`,
      )
      .all()

    expect(sesionesForaDeFecha).toHaveLength(0)
  })
})

describe('detección de datos inválidos', () => {
  it('detecta voto duplicado (mismo legislador + proyecto)', () => {
    const datos = insertarDatosPrueba()

    // Intentar insertar voto duplicado - FK constraints on, debería poder insertarse
    // pero nuestro invariante de no duplicados debería detectarlo
    db.insert(votos)
      .values({
        proyectoLeyId: datos.proyecto.id,
        legisladorId: datos.leg1.id,
        voto: 'negativo',
      })
      .run()

    const duplicados = sqlite
      .prepare(
        `SELECT legislador_id, proyecto_ley_id, COUNT(*) as n
         FROM votos
         GROUP BY legislador_id, proyecto_ley_id
         HAVING n > 1`,
      )
      .all()

    expect(duplicados.length).toBeGreaterThan(0)
  })

  it('detecta sesión fuera del rango de legislatura', () => {
    const datos = insertarDatosPrueba()

    // Insertar sesión con fecha fuera de la legislatura 50 (inicio: 2025-02-15)
    db.insert(sesiones)
      .values({
        legislaturaId: datos.leg50.id,
        camara: 'senado',
        fecha: '2020-01-01', // fuera de rango
        numero: 999,
      })
      .run()

    const sesionesForaDeFecha = sqlite
      .prepare(
        `SELECT s.id FROM sesiones s
         JOIN legislaturas lg ON s.legislatura_id = lg.id
         WHERE s.fecha < lg.fecha_inicio
            OR (lg.fecha_fin IS NOT NULL AND s.fecha > lg.fecha_fin)`,
      )
      .all()

    expect(sesionesForaDeFecha.length).toBeGreaterThan(0)
  })

  it('foreign key previene voto con legislador inexistente', () => {
    insertarDatosPrueba()

    const proyecto = db.select().from(proyectosLey).get()!

    expect(() => {
      db.insert(votos)
        .values({
          proyectoLeyId: proyecto.id,
          legisladorId: 99999,
          voto: 'afirmativo',
        })
        .run()
    }).toThrow()
  })

  it('foreign key previene voto con proyecto inexistente', () => {
    insertarDatosPrueba()

    const legislador = db.select().from(legisladores).get()!

    expect(() => {
      db.insert(votos)
        .values({
          proyectoLeyId: 99999,
          legisladorId: legislador.id,
          voto: 'afirmativo',
        })
        .run()
    }).toThrow()
  })

  it('detecta exceso de votos para cámara de senado', () => {
    const datos = insertarDatosPrueba()

    // Insertar muchos legisladores y votos para superar el máximo del senado
    const legIds: number[] = [datos.leg1.id, datos.leg2.id]

    for (let i = 0; i < 35; i++) {
      const leg = db
        .insert(legisladores)
        .values({
          nombre: `Senador Test ${i}`,
          partidoId: datos.partidoFA.id,
          camara: 'senado',
        })
        .returning()
        .get()
      legIds.push(leg.id)
    }

    // Insertar votos para todos
    for (const legId of legIds) {
      // Evitar duplicados con leg1 y leg2 que ya tienen voto
      if (legId === datos.leg1.id || legId === datos.leg2.id) continue

      db.insert(votos)
        .values({
          proyectoLeyId: datos.proyecto.id,
          legisladorId: legId,
          voto: 'afirmativo',
        })
        .run()
    }

    const conteo = sqlite
      .prepare(
        `SELECT COUNT(v.id) as total_votos
         FROM votos v
         WHERE v.proyecto_ley_id = ?`,
      )
      .get(datos.proyecto.id) as { total_votos: number }

    expect(conteo.total_votos).toBeGreaterThan(MIEMBROS_POR_CAMARA.senado)
  })
})
