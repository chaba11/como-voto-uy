import { afterEach, describe, expect, it } from 'vitest'
import { legisladores } from '@como-voto-uy/shared'
import { votacionesAModeloNuevo } from '../../src/loader/cargador-votaciones-representantes.js'
import { crearContextoPrueba } from '../utils/escenario-votaciones.js'

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
        legislaturaId: contexto.ids.legislaturaId,
        partidoId: contexto.ids.partidoFaId,
        camara: 'representantes',
        origenPartido: 'padron',
      })
      .returning({ id: legisladores.id })
      .get()

    const gandini = contexto.db
      .insert(legisladores)
      .values({
        nombre: 'Gandini, Jorge A.',
        legislaturaId: contexto.ids.legislaturaId,
        partidoId: contexto.ids.partidoPnId,
        camara: 'representantes',
        origenPartido: 'padron',
      })
      .returning({ id: legisladores.id })
      .get()

    const { votaciones, votosCount } = votacionesAModeloNuevo(contexto.db, contexto.ids.legislaturaId, [
      {
        sesion: 5,
        fecha: '2025/05/05',
        votacionNumero: '1',
        siVoto: 2,
        noVoto: 1,
        listaSi: ['Abdala, Pablo D.'],
        listaNo: ['Gandini, Jorge A.'],
        nombreProyecto: 'Proyecto de ley sobre datos abiertos',
        tituloPublico: 'Datos abiertos',
        origenTitulo: 'estructurado',
        calidadTitulo: 'canonico',
      },
    ])

    expect(votaciones).toHaveLength(1)
    expect(votosCount).toBe(2)
    expect(votaciones[0].modalidad).toBe('electronica')
    expect(votaciones[0].estadoCobertura).toBe('individual_confirmado')
    expect(votaciones[0].asunto?.nombre).toBe('Datos abiertos')
    expect(votaciones[0].asunto?.tituloPublico).toBe('Datos abiertos')
    expect(votaciones[0].votosIndividuales?.map((v) => v.legisladorId)).toEqual([
      abdala.id,
      gandini.id,
    ])
  })

  it('asigna un identificador honesto y único cuando el asunto no pudo detectarse', () => {
    const { votaciones } = votacionesAModeloNuevo(contexto.db, contexto.ids.legislaturaId, [
      {
        sesion: 7,
        fecha: '2025/05/06',
        votacionNumero: '3',
        siVoto: 50,
        noVoto: 40,
        listaSi: [],
        listaNo: [],
        nombreProyecto: 'Asunto sin título identificable',
        tituloPublico: 'Asunto sin título identificable',
        origenTitulo: 'identificador',
        calidadTitulo: 'incompleto',
      },
    ])

    expect(votaciones[0].asunto?.calidadTitulo).toBe('incompleto')
    expect(votaciones[0].asunto?.tituloPublico).toContain('Votación sin asunto identificado')
    expect(votaciones[0].asunto?.tituloPublico).toContain('Sesión 7')
    expect(votaciones[0].asunto?.codigoOficial).toBe('rep-l50-s7-v3')
    expect(votaciones[0].nivelConfianza).toBe('medio')
  })

  it('reutiliza el asunto principal cuando una votación posterior solo trae texto de artículo', () => {
    const { votaciones } = votacionesAModeloNuevo(contexto.db, contexto.ids.legislaturaId, [
      {
        sesion: 16,
        fecha: '2025/05/28',
        votacionNumero: '1',
        siVoto: 95,
        noVoto: 4,
        listaSi: [],
        listaNo: [],
        nombreProyecto:
          '20.- Ley Orgánica de la Caja de Jubilaciones y Pensiones de Profesionales Universitarios. (Modificación)',
        tituloPublico:
          '20.- Ley Orgánica de la Caja de Jubilaciones y Pensiones de Profesionales Universitarios. (Modificación)',
        origenTitulo: 'estructurado',
        calidadTitulo: 'canonico',
      },
      {
        sesion: 16,
        fecha: '2025/05/28',
        votacionNumero: '2',
        siVoto: 48,
        noVoto: 51,
        listaSi: [],
        listaNo: [],
        nombreProyecto: '(Normas aplicables).- Los empleados de la Caja quedarán incluidos en esta Ley',
        tituloPublico: '(Normas aplicables).- Los empleados de la Caja quedarán incluidos en esta Ley',
        origenTitulo: 'estructurado',
        calidadTitulo: 'canonico',
      },
    ])

    expect(votaciones[1].asunto?.tituloPublico).toBe(
      'Ley Orgánica de la Caja de Jubilaciones y Pensiones de Profesionales Universitarios. (Modificación)',
    )
  })

  it('propaga el asunto canónico cuando una votación incompleta queda entre dos votos del mismo asunto', () => {
    const { votaciones } = votacionesAModeloNuevo(contexto.db, contexto.ids.legislaturaId, [
      {
        sesion: 16,
        fecha: '2025/05/28',
        votacionNumero: '1',
        siVoto: 95,
        noVoto: 4,
        listaSi: [],
        listaNo: [],
        nombreProyecto:
          '20.- Ley Orgánica de la Caja de Jubilaciones y Pensiones de Profesionales Universitarios. (Modificación)',
        tituloPublico:
          '20.- Ley Orgánica de la Caja de Jubilaciones y Pensiones de Profesionales Universitarios. (Modificación)',
        origenTitulo: 'estructurado',
        calidadTitulo: 'canonico',
      },
      {
        sesion: 16,
        fecha: '2025/05/28',
        votacionNumero: '2',
        siVoto: 48,
        noVoto: 51,
        listaSi: [],
        listaNo: [],
        nombreProyecto: 'Asunto sin título identificable',
        tituloPublico: 'Asunto sin título identificable',
        origenTitulo: 'identificador',
        calidadTitulo: 'incompleto',
      },
      {
        sesion: 16,
        fecha: '2025/05/28',
        votacionNumero: '3',
        siVoto: 94,
        noVoto: 5,
        listaSi: [],
        listaNo: [],
        nombreProyecto:
          'Ley Orgánica de la Caja de Jubilaciones y Pensiones de Profesionales Universitarios. (Modificación)',
        tituloPublico:
          'Ley Orgánica de la Caja de Jubilaciones y Pensiones de Profesionales Universitarios. (Modificación)',
        origenTitulo: 'estructurado',
        calidadTitulo: 'canonico',
      },
    ])

    expect(votaciones[1].asunto?.tituloPublico).toBe(
      'Ley Orgánica de la Caja de Jubilaciones y Pensiones de Profesionales Universitarios. (Modificación)',
    )
    expect(votaciones[1].asunto?.codigoOficial).toBe(votaciones[0].asunto?.codigoOficial)
    expect(votaciones[2].asunto?.codigoOficial).toBe(votaciones[0].asunto?.codigoOficial)
  })

  it('usa un código estable por título cuando no hay carpeta ni repartido', () => {
    const { votaciones } = votacionesAModeloNuevo(contexto.db, contexto.ids.legislaturaId, [
      {
        sesion: 8,
        fecha: '2025/04/02',
        votacionNumero: '1',
        siVoto: 50,
        noVoto: 49,
        listaSi: [],
        listaNo: [],
        nombreProyecto: 'Pase a la Comisión Especial de Asuntos Municipales',
        tituloPublico: 'Pase a la Comisión Especial de Asuntos Municipales',
        origenTitulo: 'contexto',
        calidadTitulo: 'razonable',
      },
      {
        sesion: 8,
        fecha: '2025/04/02',
        votacionNumero: '2',
        siVoto: 50,
        noVoto: 49,
        listaSi: [],
        listaNo: [],
        nombreProyecto: 'Pase a la Comisión Especial de Asuntos Municipales',
        tituloPublico: 'Pase a la Comisión Especial de Asuntos Municipales',
        origenTitulo: 'contexto',
        calidadTitulo: 'razonable',
      },
    ])

    expect(votaciones[0].asunto?.codigoOficial).toBe(
      'rep-l50-pase-a-la-comision-especial-de-asuntos-municipales',
    )
    expect(votaciones[1].asunto?.codigoOficial).toBe(votaciones[0].asunto?.codigoOficial)
  })
})
