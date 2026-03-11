import { afterEach, describe, expect, it } from 'vitest'
import { count, eq, sql } from 'drizzle-orm'
import {
  asuntos,
  partidos,
  votaciones,
  votosIndividuales,
} from '@como-voto-uy/shared'
import {
  crearContextoPrueba,
  insertarSesionAgregada,
  insertarSesionNominal,
  insertarSesionRepresentantes,
} from './utils/escenario-votaciones.js'

describe('estadísticas sobre el nuevo modelo', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes; DELETE FROM legisladores WHERE id > 2;')
  })

  it('cuenta asuntos y votaciones por separado', () => {
    insertarSesionNominal(contexto)
    insertarSesionAgregada(contexto)

    expect(contexto.db.select({ total: count() }).from(asuntos).get()?.total).toBe(2)
    expect(contexto.db.select({ total: count() }).from(votaciones).get()?.total).toBe(2)
  })

  it('calcula participación usando solo votos individuales', () => {
    insertarSesionNominal(contexto)
    insertarSesionRepresentantes(contexto)

    const resultado = contexto.sqlite.prepare(`
      SELECT
        legislador_id as legisladorId,
        COUNT(*) as total,
        SUM(CASE WHEN voto != 'ausente' THEN 1 ELSE 0 END) as presentes
      FROM votos_individuales
      GROUP BY legislador_id
      ORDER BY legislador_id
    `).all() as { legisladorId: number; total: number; presentes: number }[]

    expect(resultado.length).toBeGreaterThanOrEqual(2)
    for (const fila of resultado) {
      expect(fila.presentes).toBeLessThanOrEqual(fila.total)
    }
  })

  it('calcula afinidad partidaria solo sobre confianza confirmada o alta', () => {
    insertarSesionNominal(contexto)

    const afinidad = contexto.sqlite.prepare(`
      SELECT
        p.sigla as partido,
        SUM(CASE WHEN vi.voto = 'afirmativo' THEN 1 ELSE 0 END) as afirmativos,
        SUM(CASE WHEN vi.voto = 'negativo' THEN 1 ELSE 0 END) as negativos
      FROM votos_individuales vi
      JOIN legisladores l ON l.id = vi.legislador_id
      JOIN partidos p ON p.id = l.partido_id
      WHERE vi.nivel_confianza IN ('confirmado', 'alto')
      GROUP BY p.id
      ORDER BY p.sigla
    `).all() as { partido: string; afirmativos: number; negativos: number }[]

    expect(afinidad).toHaveLength(2)
    expect(afinidad.find((fila) => fila.partido === 'FA')?.afirmativos).toBe(1)
    expect(afinidad.find((fila) => fila.partido === 'PN')?.negativos).toBe(1)
  })

  it('no penaliza como ausente una votación solo agregada', () => {
    insertarSesionAgregada(contexto)

    const totalVotosIndividuales = contexto.db
      .select({ total: count() })
      .from(votosIndividuales)
      .get()

    expect(totalVotosIndividuales?.total).toBe(0)
  })
})
