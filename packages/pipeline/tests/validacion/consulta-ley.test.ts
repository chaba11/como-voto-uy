import { afterEach, describe, expect, it } from 'vitest'
import {
  asuntos,
  resultadosAgregados,
  sesiones,
  votaciones,
  votosIndividuales,
} from '@como-voto-uy/shared'
import {
  crearContextoPrueba,
  insertarSesionAgregada,
  insertarSesionNominal,
} from '../utils/escenario-votaciones.js'

describe('consulta de asunto/ley', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes;')
  })

  it('devuelve múltiples votaciones asociadas al mismo asunto cuando existen', () => {
    insertarSesionNominal(contexto)

    const asunto = contexto.db.select().from(asuntos).get()!
    contexto.db.insert(sesiones)
      .values({
        legislaturaId: contexto.ids.legislaturaId,
        cuerpo: 'asamblea_general',
        fecha: '2025-04-20',
        numero: 9,
      })
      .run()
    const sesionAgId = contexto.db.select().from(sesiones).all().at(-1)!.id
    contexto.db.insert(votaciones)
      .values({
        sesionId: sesionAgId,
        asuntoId: asunto.id,
        modalidad: 'nominal',
        estadoCobertura: 'individual_confirmado',
        nivelConfianza: 'alto',
        esOficial: true,
        resultado: 'afirmativa',
      })
      .run()

    const timeline = contexto.sqlite.prepare(`
      SELECT s.cuerpo, s.fecha
      FROM votaciones v
      JOIN sesiones s ON s.id = v.sesion_id
      WHERE v.asunto_id = ?
      ORDER BY s.fecha
    `).all(asunto.id) as { cuerpo: string; fecha: string }[]

    expect(timeline).toHaveLength(2)
    expect(timeline.map((fila) => fila.cuerpo)).toEqual(['senado', 'asamblea_general'])
  })

  it('muestra resultado agregado cuando no existe desglose individual', () => {
    insertarSesionAgregada(contexto)

    const fila = contexto.sqlite.prepare(`
      SELECT
        a.nombre,
        s.cuerpo,
        ra.afirmativos,
        ra.total_presentes as totalPresentes
      FROM asuntos a
      JOIN votaciones v ON v.asunto_id = a.id
      JOIN sesiones s ON s.id = v.sesion_id
      JOIN resultados_agregados ra ON ra.votacion_id = v.id
    `).get() as {
      nombre: string
      cuerpo: string
      afirmativos: number
      totalPresentes: number
    }

    expect(fila.nombre).toContain('receso')
    expect(fila.cuerpo).toBe('senado')
    expect(fila.afirmativos).toBe(28)
    expect(fila.totalPresentes).toBe(28)
    expect(contexto.db.select().from(votosIndividuales).all()).toHaveLength(0)
  })
})
