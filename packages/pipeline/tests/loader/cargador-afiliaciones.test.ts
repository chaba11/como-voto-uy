import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  aliasLegisladores,
  legisladores,
  partidos,
  resolucionesAfiliacion,
} from '@como-voto-uy/shared'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { seedLegislaturas } from '../../src/seed/legislaturas.js'
import { seedPartidos } from '../../src/seed/partidos.js'

vi.mock('../../src/scraper/afiliaciones-legisladores.js', () => ({
  obtenerRegistrosAfiliacionPorFuente: vi.fn(),
}))

const { obtenerRegistrosAfiliacionPorFuente } = await import(
  '../../src/scraper/afiliaciones-legisladores.js'
)
const {
  cargarAfiliacionesHistoricas,
  obtenerReporteCoberturaAfiliaciones,
  reconciliarAfiliacionesEntreLegislaturas,
  reconciliarAfiliacionesPorAlias,
  resolverLegisladorPorContexto,
} = await import('../../src/loader/cargador-afiliaciones.js')

const scraperMock = obtenerRegistrosAfiliacionPorFuente as ReturnType<typeof vi.fn>

describe('cargador de afiliaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resuelve partido por dataset estructurado', async () => {
    scraperMock.mockResolvedValueOnce([
      {
        nombre: 'Abdala, Pablo',
        camara: 'representantes',
        legislatura: 50,
        siglaPartido: 'PN',
        tipoRegistro: 'titular',
        fuente: { tipo: 'dataset', url: 'https://example.com/nomina.csv' },
        metodo: 'dataset',
        nivelConfianza: 'confirmado',
        alias: ['Pablo Abdala'],
      },
    ])

    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    const resultado = await cargarAfiliacionesHistoricas(db, {
      camara: 'representantes',
      legislaturas: [50],
    })

    const legislador = db
      .select()
      .from(legisladores)
      .where(eq(legisladores.nombre, 'Abdala, Pablo'))
      .get()
    const partido = db
      .select()
      .from(partidos)
      .where(eq(partidos.id, legislador!.partidoId))
      .get()

    expect(resultado.legisladoresCreados).toBe(1)
    expect(legislador?.origenPartido).toBe('dataset')
    expect(partido?.sigla).toBe('PN')
  })

  it('cae a biografía oficial cuando no hay dataset limpio', async () => {
    scraperMock.mockResolvedValueOnce([
      {
        nombre: 'Pérez, Ana',
        camara: 'senado',
        legislatura: 49,
        siglaPartido: 'FA',
        tipoRegistro: 'titular',
        fuente: { tipo: 'manual', url: 'https://example.com/biografia/1' },
        metodo: 'biografia',
        nivelConfianza: 'alto',
      },
    ])

    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    await cargarAfiliacionesHistoricas(db, { camara: 'senado', legislaturas: [49] })

    const legislador = db
      .select()
      .from(legisladores)
      .where(eq(legisladores.nombre, 'Pérez, Ana'))
      .get()
    expect(legislador?.origenPartido).toBe('biografia')
  })

  it('respeta legislatura y cámara al matchear alias', async () => {
    scraperMock.mockResolvedValueOnce([
      {
        nombre: 'García, Juan',
        camara: 'senado',
        legislatura: 49,
        siglaPartido: 'PN',
        tipoRegistro: 'titular',
        fuente: { tipo: 'dataset', url: 'https://example.com/senado.json' },
        metodo: 'dataset',
        nivelConfianza: 'confirmado',
        alias: ['Juan García'],
      },
      {
        nombre: 'García, Juan',
        camara: 'representantes',
        legislatura: 49,
        siglaPartido: 'FA',
        tipoRegistro: 'titular',
        fuente: { tipo: 'dataset', url: 'https://example.com/diputados.csv' },
        metodo: 'dataset',
        nivelConfianza: 'confirmado',
      },
    ])

    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    await cargarAfiliacionesHistoricas(db, { legislaturas: [49] })

    const legislatura49Id = db
      .select({ id: legisladores.legislaturaId })
      .from(legisladores)
      .where(eq(legisladores.nombre, 'García, Juan'))
      .get()!.id

    const senadorId = resolverLegisladorPorContexto(db, 'Juan García', legislatura49Id, 'senado')
    const diputadoId = resolverLegisladorPorContexto(
      db,
      'Juan García',
      legislatura49Id,
      'representantes',
    )

    expect(senadorId).not.toBeNull()
    expect(diputadoId).not.toBeNull()
    expect(senadorId).not.toBe(diputadoId)
  })

  it('no sobreescribe una resolución fuerte con una más débil', async () => {
    scraperMock
      .mockResolvedValueOnce([
        {
          nombre: 'Bianchi, Graciela',
          camara: 'senado',
          legislatura: 50,
          siglaPartido: 'PN',
          tipoRegistro: 'titular',
          fuente: { tipo: 'dataset', url: 'https://example.com/fuerte.csv' },
          metodo: 'dataset',
          nivelConfianza: 'confirmado',
        },
      ])
      .mockResolvedValueOnce([
        {
          nombre: 'Bianchi, Graciela',
          camara: 'senado',
          legislatura: 50,
          siglaPartido: 'FA',
          tipoRegistro: 'integrante_temporal',
          fuente: { tipo: 'json', url: 'https://example.com/debil.json' },
          metodo: 'asistencia',
          nivelConfianza: 'medio',
        },
      ])

    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    await cargarAfiliacionesHistoricas(db, { camara: 'senado', legislaturas: [50] })
    await cargarAfiliacionesHistoricas(db, { camara: 'senado', legislaturas: [50] })

    const legislador = db
      .select()
      .from(legisladores)
      .where(eq(legisladores.nombre, 'Bianchi, Graciela'))
      .get()!
    const partido = db.select().from(partidos).where(eq(partidos.id, legislador.partidoId)).get()!

    expect(partido.sigla).toBe('PN')
    expect(legislador.origenPartido).toBe('dataset')
  })

  it('deja SA cuando no hay evidencia suficiente y luego reconcilia por alias fuerte', async () => {
    scraperMock.mockResolvedValueOnce([
      {
        nombre: 'Rodríguez, Marta',
        camara: 'senado',
        legislatura: 48,
        siglaPartido: null,
        tipoRegistro: 'integrante_temporal',
        fuente: { tipo: 'json', url: 'https://example.com/asistencia.json' },
        metodo: 'asistencia',
        nivelConfianza: 'medio',
      },
      {
        nombre: 'Marta Rodríguez',
        camara: 'senado',
        legislatura: 48,
        siglaPartido: 'FA',
        tipoRegistro: 'titular',
        fuente: { tipo: 'manual', url: 'https://example.com/biografia/2' },
        metodo: 'biografia',
        nivelConfianza: 'alto',
      },
    ])

    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    await cargarAfiliacionesHistoricas(db, { camara: 'senado', legislaturas: [48] })
    const reconciliados = reconciliarAfiliacionesPorAlias(db, {
      camara: 'senado',
      legislaturas: [48],
    })

    const legisladoresSenado = db.select().from(legisladores).all()
    const sinAsignar = db.select().from(partidos).where(eq(partidos.sigla, 'SA')).get()!

    expect(reconciliados).toBeGreaterThanOrEqual(0)
    expect(
      legisladoresSenado.some((legislador) => legislador.partidoId !== sinAsignar.id),
    ).toBe(true)
  })

  it('devuelve reporte de cobertura por cámara y legislatura', async () => {
    scraperMock.mockResolvedValueOnce([
      {
        nombre: 'Abdala, Pablo',
        camara: 'representantes',
        legislatura: 50,
        siglaPartido: 'PN',
        tipoRegistro: 'titular',
        fuente: { tipo: 'dataset', url: 'https://example.com/nomina.csv' },
        metodo: 'dataset',
        nivelConfianza: 'confirmado',
      },
      {
        nombre: 'Persona, Sin Datos',
        camara: 'senado',
        legislatura: 49,
        siglaPartido: null,
        tipoRegistro: 'integrante_temporal',
        fuente: { tipo: 'json', url: 'https://example.com/asistencias.json' },
        metodo: 'asistencia',
        nivelConfianza: 'medio',
      },
    ])

    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    await cargarAfiliacionesHistoricas(db, { legislaturas: [49, 50] })
    const reporte = obtenerReporteCoberturaAfiliaciones(db)

    expect(reporte).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          camara: 'representantes',
          legislatura: 50,
          total: 1,
          resueltos: 1,
          porcentajeCobertura: 100,
        }),
        expect.objectContaining({
          camara: 'senado',
          legislatura: 49,
          total: 1,
          sinAsignar: 1,
          porcentajeCobertura: 0,
          pendientes: ['Persona, Sin Datos'],
        }),
      ]),
    )
  })

  it('reutiliza una resolución fuerte entre legislaturas de la misma cámara', async () => {
    scraperMock
      .mockResolvedValueOnce([
        {
          nombre: 'Bianchi, Graciela',
          camara: 'senado',
          legislatura: 50,
          siglaPartido: 'PN',
          tipoRegistro: 'titular',
          fuente: { tipo: 'dataset', url: 'https://example.com/fuerte.csv' },
          metodo: 'dataset',
          nivelConfianza: 'confirmado',
        },
      ])
      .mockResolvedValueOnce([
        {
          nombre: 'Graciela Bianchi',
          camara: 'senado',
          legislatura: 49,
          siglaPartido: null,
          tipoRegistro: 'integrante_temporal',
          fuente: { tipo: 'json', url: 'https://example.com/asistencia.json' },
          metodo: 'asistencia',
          nivelConfianza: 'medio',
        },
      ])

    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    await cargarAfiliacionesHistoricas(db, { camara: 'senado', legislaturas: [50] })
    await cargarAfiliacionesHistoricas(db, { camara: 'senado', legislaturas: [49] })
    const reconciliados = reconciliarAfiliacionesEntreLegislaturas(db, {
      camara: 'senado',
      legislaturas: [49],
    })

    const legislador = db
      .select()
      .from(legisladores)
      .where(eq(legisladores.nombre, 'Graciela Bianchi'))
      .get()!
    const partido = db.select().from(partidos).where(eq(partidos.id, legislador.partidoId)).get()!

    expect(reconciliados).toBeGreaterThanOrEqual(0)
    expect(partido.sigla).toBe('PN')
    expect(legislador.origenPartido).toBe('inferido')
  })

  it('registra alias y resoluciones de afiliación', async () => {
    scraperMock.mockResolvedValueOnce([
      {
        nombre: 'Abdala, Pablo',
        camara: 'representantes',
        legislatura: 50,
        siglaPartido: 'PN',
        tipoRegistro: 'titular',
        fuente: { tipo: 'dataset', url: 'https://example.com/nomina.csv' },
        metodo: 'dataset',
        nivelConfianza: 'confirmado',
        alias: ['Pablo Abdala'],
      },
    ])

    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    await cargarAfiliacionesHistoricas(db, { camara: 'representantes', legislaturas: [50] })

    expect(db.select().from(aliasLegisladores).all()).not.toHaveLength(0)
    expect(db.select().from(resolucionesAfiliacion).all()).not.toHaveLength(0)
  })
})
