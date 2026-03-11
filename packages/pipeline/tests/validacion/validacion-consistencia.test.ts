import { afterEach, describe, expect, it } from 'vitest'
import { count, eq } from 'drizzle-orm'
import {
  legisladores,
  MIEMBROS_POR_CUERPO,
  resultadosAgregados,
  sesiones,
  votaciones,
  votosIndividuales,
} from '@como-voto-uy/shared'
import {
  crearContextoPrueba,
  insertarSesionAgregada,
  insertarSesionNominal,
  insertarSesionRepresentantes,
} from '../utils/escenario-votaciones.js'

describe('validación de consistencia de datos', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes; DELETE FROM legisladores WHERE id > 2;')
  })

  it('cada voto individual referencia un legislador y una votación existente', () => {
    insertarSesionNominal(contexto)

    const votosHuerfanos = contexto.sqlite.prepare(`
      SELECT vi.id
      FROM votos_individuales vi
      LEFT JOIN legisladores l ON l.id = vi.legislador_id
      LEFT JOIN votaciones v ON v.id = vi.votacion_id
      WHERE l.id IS NULL OR v.id IS NULL
    `).all()

    expect(votosHuerfanos).toHaveLength(0)
  })

  it('no hay votos duplicados para la misma votación y legislador', () => {
    insertarSesionNominal(contexto)

    const duplicados = contexto.sqlite.prepare(`
      SELECT votacion_id, legislador_id, COUNT(*) as cantidad
      FROM votos_individuales
      GROUP BY votacion_id, legislador_id
      HAVING cantidad > 1
    `).all()

    expect(duplicados).toHaveLength(0)
  })

  it('las fechas de sesión quedan dentro del rango de su legislatura', () => {
    insertarSesionNominal(contexto)

    const fueraDeRango = contexto.sqlite.prepare(`
      SELECT s.id
      FROM sesiones s
      JOIN legislaturas l ON l.id = s.legislatura_id
      WHERE s.fecha < l.fecha_inicio
         OR (l.fecha_fin IS NOT NULL AND s.fecha > l.fecha_fin)
    `).all()

    expect(fueraDeRango).toHaveLength(0)
  })

  it('una votación agregada puede existir sin votos individuales', () => {
    insertarSesionAgregada(contexto)

    expect(contexto.db.select({ total: count() }).from(resultadosAgregados).get()?.total).toBe(1)
    expect(contexto.db.select({ total: count() }).from(votosIndividuales).get()?.total).toBe(0)
  })

  it('la cantidad de votos individuales no excede el cuerpo de la sesión', () => {
    insertarSesionNominal(contexto)
    insertarSesionRepresentantes(contexto)

    const conteos = contexto.sqlite.prepare(`
      SELECT
        s.cuerpo,
        v.id as votacionId,
        COUNT(vi.id) as total
      FROM votaciones v
      JOIN sesiones s ON s.id = v.sesion_id
      LEFT JOIN votos_individuales vi ON vi.votacion_id = v.id
      GROUP BY v.id, s.cuerpo
    `).all() as { cuerpo: keyof typeof MIEMBROS_POR_CUERPO; votacionId: number; total: number }[]

    for (const conteo of conteos) {
      expect(conteo.total).toBeLessThanOrEqual(MIEMBROS_POR_CUERPO[conteo.cuerpo])
    }
  })

  it('la unique key previene duplicados reales en votos individuales', () => {
    insertarSesionNominal(contexto)
    const votacion = contexto.db.select().from(votaciones).get()!

    expect(() => {
      contexto.db.insert(votosIndividuales)
        .values({
          votacionId: votacion.id,
          legisladorId: contexto.ids.legisladorFaId,
          voto: 'afirmativo',
          nivelConfianza: 'confirmado',
        })
        .run()
    }).toThrow()
  })
})
