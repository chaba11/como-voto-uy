import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { count } from 'drizzle-orm'
import { asuntos, legisladores, votosIndividuales } from '@como-voto-uy/shared'
import { extraerTextoDeHtml } from '../../src/scraper/extractor-texto.js'
import { parsearTaquigrafica } from '../../src/parser/index.js'
import { votacionADatosVotacion, votacionesADatosSesion } from '../../src/pipeline.js'
import { crearContextoPrueba } from '../utils/escenario-votaciones.js'
import { cargarSesion } from '../../src/loader/cargador-sesion.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rutaFixture = resolve(__dirname, '../fixtures/taquigrafica-nominal.html')

describe('flujo pipeline completo', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec(
      'DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes;',
    )
  })

  it('parsea fixture, carga votaciones y deja votos individuales vinculados a asuntos', () => {
    const html = readFileSync(rutaFixture, 'utf-8')
    const texto = extraerTextoDeHtml(html)
    const parseo = parsearTaquigrafica(texto)
    const nominal = parseo.votaciones.find((votacion) => votacion.tipo === 'nominal')

    expect(nominal).toBeDefined()

    const listaLegisladores = contexto.db
      .select({
        id: legisladores.id,
        nombre: legisladores.nombre,
        camara: legisladores.camara,
        legislaturaId: legisladores.legislaturaId,
        partidoId: legisladores.partidoId,
      })
      .from(legisladores)
      .all()

    const datosVotacion = votacionADatosVotacion(
      contexto.db,
      'senado',
      contexto.ids.legislaturaId,
      nominal!,
      listaLegisladores,
      1,
      'https://parlamento.gub.uy/sesion-fixture',
    )

    cargarSesion(contexto.db, {
      legislaturaId: contexto.ids.legislaturaId,
      cuerpo: 'senado',
      fecha: '2025-05-10',
      numero: 8,
      votaciones: [datosVotacion],
    })

    expect(contexto.db.select({ total: count() }).from(asuntos).get()?.total).toBe(1)
    expect(contexto.db.select({ total: count() }).from(votosIndividuales).get()?.total).toBeGreaterThan(0)
  })

  it('hereda el asunto principal cuando una votación agregada solo trae ruido parlamentario', () => {
    const listaLegisladores = contexto.db
      .select({
        id: legisladores.id,
        nombre: legisladores.nombre,
        camara: legisladores.camara,
        legislaturaId: legisladores.legislaturaId,
        partidoId: legisladores.partidoId,
      })
      .from(legisladores)
      .all()

    const votaciones = votacionesADatosSesion(
      contexto.db,
      'senado',
      contexto.ids.legislaturaId,
      [
        {
          tipo: 'agregada',
          textoContexto:
            'Mocionamos para que se declare urgente y se considere de inmediato la carpeta n.º 472/2025: proyecto de ley por el que se faculta al Ministerio de Trabajo y Seguridad Social a extender por razones de interés general el subsidio por desempleo.',
          proyecto: {
            carpeta: '472',
            nombre:
              'Proyecto de ley por el que se faculta al Ministerio de Trabajo y Seguridad Social a extender por razones de interés general el subsidio por desempleo.',
          },
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
        {
          tipo: 'agregada',
          textoContexto:
            'U NA N IMIDA D. En consideración el artículo 1.º. Si no se hace uso de la palabra,',
          proyecto: {},
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
      ],
      listaLegisladores,
      'https://parlamento.gub.uy/sesion-fixture',
      52,
    )

    expect(votaciones[0].asunto?.tituloPublico).toContain(
      'Faculta al Ministerio de Trabajo y Seguridad Social',
    )
    expect(votaciones[1].asunto?.tituloPublico).toBe(votaciones[0].asunto?.tituloPublico)
    expect(votaciones[1].detalleTitulo).toContain('En consideración el artículo 1')
  })

  it('aplica override manual de Senado por sesión y orden cuando existe', () => {
    const listaLegisladores = contexto.db
      .select({
        id: legisladores.id,
        nombre: legisladores.nombre,
        camara: legisladores.camara,
        legislaturaId: legisladores.legislaturaId,
        partidoId: legisladores.partidoId,
      })
      .from(legisladores)
      .all()

    const votaciones = votacionesADatosSesion(
      contexto.db,
      'senado',
      contexto.ids.legislaturaId,
      [
        {
          tipo: 'agregada',
          textoContexto: 'Proyecto de ley por el que se declara feriado laborable.',
          proyecto: { nombre: 'Proyecto de ley por el que se declara feriado laborable.' },
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
        {
          tipo: 'agregada',
          textoContexto: 'Proyecto de minuta de comunicación por el que se solicita información.',
          proyecto: {
            nombre: 'Proyecto de minuta de comunicación por el que se solicita información.',
          },
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
        {
          tipo: 'agregada',
          textoContexto: 'Proyecto de resolución relativo a una conmemoración.',
          proyecto: { nombre: 'Proyecto de resolución relativo a una conmemoración.' },
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
        {
          tipo: 'agregada',
          textoContexto:
            'El Poder Ejecutivo solicita que se apruebe un proyecto de ley con artículo único, tal como está establecido en el repartido que se encuentra sobre los escritorios de los señores senadores.',
          proyecto: {},
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
      ],
      listaLegisladores,
      'https://parlamento.gub.uy/sesion-fixture',
      53,
    )

    expect(votaciones[3].asunto?.tituloPublico).toBe(
      'Cooperación y apoyo logístico internacional. (Autorización)',
    )
  })
  it('hereda el asunto padre cuando el contexto del Senado es conversacional o genérico', () => {
    const listaLegisladores = contexto.db
      .select({
        id: legisladores.id,
        nombre: legisladores.nombre,
        camara: legisladores.camara,
        legislaturaId: legisladores.legislaturaId,
        partidoId: legisladores.partidoId,
      })
      .from(legisladores)
      .all()

    const votaciones = votacionesADatosSesion(
      contexto.db,
      'senado',
      contexto.ids.legislaturaId,
      [
        {
          tipo: 'agregada',
          textoContexto:
            'Proyecto de ley por el que se aprueba el Presupuesto nacional 2025-2029.',
          proyecto: {
            nombre: 'Proyecto de ley por el que se aprueba el Presupuesto nacional 2025-2029.',
          },
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
        {
          tipo: 'agregada',
          textoContexto:
            'Salvo los artículos que ya votamos en bloque, se votarán los artículos a los que se ha referido el senador. En consideración el artículo 27.',
          proyecto: {},
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
        {
          tipo: 'agregada',
          textoContexto: 'proyecto de ley.',
          proyecto: { nombre: 'Proyecto de ley' },
          votos: [],
          resultado: { afirmativos: 19, total: 19, unanimidad: true, resultado: 'afirmativa' },
        },
      ],
      listaLegisladores,
      'https://parlamento.gub.uy/sesion-fixture',
      54,
    )

    expect(votaciones[0].asunto?.tituloPublico).toContain('Presupuesto nacional 2025-2029')
    expect(votaciones[1].asunto?.tituloPublico).toBe(votaciones[0].asunto?.tituloPublico)
    expect(votaciones[1].detalleTitulo).toContain('En consideración el artículo 27')
    expect(votaciones[2].asunto?.tituloPublico).toBe(votaciones[0].asunto?.tituloPublico)
  })
})
