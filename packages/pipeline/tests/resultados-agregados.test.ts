import { afterEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { resultadosAgregados, votaciones, votosIndividuales } from '@como-voto-uy/shared'
import { extraerResultadoAgregado } from '../src/parser/extractor-votos.js'
import {
  crearContextoPrueba,
  insertarSesionAgregada,
  insertarSesionNominal,
} from './utils/escenario-votaciones.js'

describe('resultados agregados en el nuevo modelo', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes;')
  })

  it('almacena una votación agregada sin crear votos individuales falsos', () => {
    insertarSesionAgregada(contexto)

    const votacion = contexto.db.select().from(votaciones).get()!
    const resultado = contexto.db
      .select()
      .from(resultadosAgregados)
      .where(eq(resultadosAgregados.votacionId, votacion.id))
      .get()!

    expect(votacion.estadoCobertura).toBe('agregado')
    expect(resultado.afirmativos).toBe(28)
    expect(resultado.unanimidad).toBe(true)
    expect(contexto.db.select().from(votosIndividuales).all()).toHaveLength(0)
  })

  it('permite convivir resultado agregado y votos individuales confirmados', () => {
    insertarSesionNominal(contexto)

    const resultado = contexto.db.select().from(resultadosAgregados).get()!
    const votos = contexto.db.select().from(votosIndividuales).all()

    expect(resultado.afirmativos).toBe(18)
    expect(resultado.negativos).toBe(13)
    expect(votos).toHaveLength(2)
  })
})

describe('extracción parser', () => {
  it('extrae resultado numérico y unanimidad', () => {
    const resultado = extraerResultadoAgregado('–31 en 31. Afirmativa. UNANIMIDAD.')
    expect(resultado).not.toBeNull()
    expect(resultado?.afirmativos).toBe(31)
    expect(resultado?.total).toBe(31)
    expect(resultado?.unanimidad).toBe(true)
  })

  it('retorna null si no hay resultado agregado', () => {
    expect(extraerResultadoAgregado('Se va a votar nominalmente.')).toBeNull()
  })
})
