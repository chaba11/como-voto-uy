import { afterEach, describe, expect, it } from 'vitest'
import { legisladores } from '@como-voto-uy/shared'
import { votacionesAModeloNuevo } from '../../src/loader/cargador-votaciones-representantes.js'
import {
  crearContextoPrueba,
} from '../utils/escenario-votaciones.js'

describe('cargador votaciones representantes', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes; DELETE FROM legisladores WHERE id > 2;')
  })

  it('convierte votaciones electrónicas matcheadas al nuevo modelo', () => {
    const abdala = contexto.db
      .insert(legisladores)
      .values({
        nombre: 'Abdala, Pablo D.',
        partidoId: contexto.ids.partidoFaId,
        camara: 'representantes',
      })
      .returning({ id: legisladores.id })
      .get()

    const gandini = contexto.db
      .insert(legisladores)
      .values({
        nombre: 'Gandini, Jorge A.',
        partidoId: contexto.ids.partidoPnId,
        camara: 'representantes',
      })
      .returning({ id: legisladores.id })
      .get()

    const { votaciones, votosCount } = votacionesAModeloNuevo(contexto.db, [
      {
        sesion: 5,
        fecha: '2025/05/05',
        votacionNumero: '1',
        siVoto: 2,
        noVoto: 1,
        listaSi: ['Abdala, Pablo D.'],
        listaNo: ['Gandini, Jorge A.'],
        nombreProyecto: 'Proyecto de ley sobre datos abiertos',
      },
    ])

    expect(votaciones).toHaveLength(1)
    expect(votosCount).toBe(2)
    expect(votaciones[0].modalidad).toBe('electronica')
    expect(votaciones[0].estadoCobertura).toBe('individual_confirmado')
    expect(votaciones[0].asunto?.nombre).toContain('datos abiertos')
    expect(votaciones[0].votosIndividuales?.map((v) => v.legisladorId)).toEqual([
      abdala.id,
      gandini.id,
    ])
  })

  it('deja la votación sin asunto cuando el match es genérico', () => {
    const { votaciones } = votacionesAModeloNuevo(contexto.db, [
      {
        sesion: 7,
        fecha: '2025/05/06',
        votacionNumero: '3',
        siVoto: 50,
        noVoto: 40,
        listaSi: [],
        listaNo: [],
        nombreProyecto: 'Votación 3',
      },
    ])

    expect(votaciones[0].asunto).toBeNull()
    expect(votaciones[0].nivelConfianza).toBe('medio')
  })
})
