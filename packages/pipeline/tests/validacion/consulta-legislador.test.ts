import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { asuntos, legisladores, sesiones, votaciones, votosIndividuales } from '@como-voto-uy/shared'
import {
  crearContextoPrueba,
  insertarSesionAgregada,
  insertarSesionNominal,
} from '../utils/escenario-votaciones.js'

describe('consulta de legislador con el nuevo modelo', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes;')
  })

  it('retorna solo votos individuales públicos del legislador', () => {
    insertarSesionNominal(contexto)
    insertarSesionAgregada(contexto)

    const votos = contexto.sqlite.prepare(`
      SELECT
        vi.voto,
        vi.nivel_confianza as nivelConfianza,
        a.nombre as asunto,
        s.fecha
      FROM votos_individuales vi
      JOIN votaciones v ON v.id = vi.votacion_id
      LEFT JOIN asuntos a ON a.id = v.asunto_id
      JOIN sesiones s ON s.id = v.sesion_id
      WHERE vi.legislador_id = ?
      ORDER BY s.fecha DESC
    `).all(contexto.ids.legisladorFaId) as {
      voto: string
      nivelConfianza: string
      asunto: string
      fecha: string
    }[]

    expect(votos).toHaveLength(1)
    expect(votos[0].voto).toBe('afirmativo')
    expect(votos[0].nivelConfianza).toBe('confirmado')
    expect(votos[0].asunto).toContain('transparencia')
  })

  it('calcula cobertura del legislador sin tratar agregadas como ausencias', () => {
    insertarSesionNominal(contexto)
    insertarSesionAgregada(contexto)

    const cobertura = contexto.sqlite.prepare(`
      SELECT
        COUNT(DISTINCT v.id) as totalVotacionesVinculadas,
        COUNT(DISTINCT vi.votacion_id) as totalConVotoIndividual
      FROM votaciones v
      LEFT JOIN votos_individuales vi
        ON vi.votacion_id = v.id
        AND vi.legislador_id = ?
      WHERE v.asunto_id IS NOT NULL
    `).get(contexto.ids.legisladorFaId) as {
      totalVotacionesVinculadas: number
      totalConVotoIndividual: number
    }

    expect(cobertura.totalVotacionesVinculadas).toBe(2)
    expect(cobertura.totalConVotoIndividual).toBe(1)
  })
})
