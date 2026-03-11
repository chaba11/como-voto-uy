import { afterEach, describe, expect, it } from 'vitest'
import {
  asuntos,
  evidencias,
  fuentes,
  resultadosAgregados,
  sesiones,
  votaciones,
  votosIndividuales,
} from '@como-voto-uy/shared'
import {
  cerrarContextoPrueba,
  crearContextoPrueba,
  insertarSesionNominal,
} from '../utils/escenario-votaciones.js'

describe('cargarSesion', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes;')
  })

  it('inserta sesión, asunto, votación, resultado y votos individuales', () => {
    insertarSesionNominal(contexto)

    expect(contexto.db.select().from(sesiones).all()).toHaveLength(1)
    expect(contexto.db.select().from(asuntos).all()).toHaveLength(1)
    expect(contexto.db.select().from(votaciones).all()).toHaveLength(1)
    expect(contexto.db.select().from(resultadosAgregados).all()).toHaveLength(1)
    expect(contexto.db.select().from(votosIndividuales).all()).toHaveLength(2)
    expect(contexto.db.select().from(fuentes).all()).toHaveLength(1)
    expect(contexto.db.select().from(evidencias).all()).toHaveLength(1)
  })

  it('persiste el vínculo opcional a fuente y asunto canónico', () => {
    insertarSesionNominal(contexto)

    const votacion = contexto.db.select().from(votaciones).get()!
    const asunto = contexto.db.select().from(asuntos).get()!
    const fuente = contexto.db.select().from(fuentes).get()!

    expect(votacion.asuntoId).toBe(asunto.id)
    expect(votacion.fuentePrincipalId).toBe(fuente.id)
    expect(votacion.estadoCobertura).toBe('individual_confirmado')
    expect(votacion.nivelConfianza).toBe('alto')
  })
})
