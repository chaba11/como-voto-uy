import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { count } from 'drizzle-orm'
import { asuntos, legisladores, votosIndividuales } from '@como-voto-uy/shared'
import { extraerTextoDeHtml } from '../../src/scraper/extractor-texto.js'
import { parsearTaquigrafica } from '../../src/parser/index.js'
import { votacionADatosVotacion } from '../../src/pipeline.js'
import {
  crearContextoPrueba,
} from '../utils/escenario-votaciones.js'
import { cargarSesion } from '../../src/loader/cargador-sesion.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rutaFixture = resolve(__dirname, '../fixtures/taquigrafica-nominal.html')

describe('flujo pipeline completo', () => {
  const contexto = crearContextoPrueba()

  afterEach(() => {
    contexto.sqlite.exec('DELETE FROM evidencias; DELETE FROM votos_individuales; DELETE FROM resultados_agregados; DELETE FROM votaciones; DELETE FROM asuntos; DELETE FROM sesiones; DELETE FROM fuentes;')
  })

  it('parsea fixture, carga votaciones y deja votos individuales vinculados a asuntos', () => {
    const html = readFileSync(rutaFixture, 'utf-8')
    const texto = extraerTextoDeHtml(html)
    const parseo = parsearTaquigrafica(texto)
    const nominal = parseo.votaciones.find((votacion) => votacion.tipo === 'nominal')

    expect(nominal).toBeDefined()

    const listaLegisladores = contexto.db
      .select({ id: legisladores.id, nombre: legisladores.nombre })
      .from(legisladores)
      .all()

    const datosVotacion = votacionADatosVotacion(
      contexto.db,
      'senado',
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
})
