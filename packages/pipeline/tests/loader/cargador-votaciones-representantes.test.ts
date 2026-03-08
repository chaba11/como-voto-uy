import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { seedPartidos } from '../../src/seed/partidos.js'
import { seedLegislaturas } from '../../src/seed/legislaturas.js'
import { seedLegisladoresRepresentantes } from '../../src/seed/legisladores-representantes.js'
import { cargarSesion } from '../../src/loader/cargador-sesion.js'
import type { DatosSesion, DatosProyecto } from '../../src/loader/cargador-sesion.js'
import { sesiones, proyectosLey, votos, legisladores, legislaturas } from '@como-voto-uy/shared'
import { eq, and } from 'drizzle-orm'
import type { VotacionRepresentantes } from '../../src/scraper/votaciones-representantes.js'
import type { VotacionMatcheada } from '../../src/parser/parser-diario-representantes.js'

function crearVotacionJson(overrides?: Partial<VotacionRepresentantes>): VotacionRepresentantes {
  return {
    Sesion: 5,
    SesionFecha: '2025/03/12',
    Votacion: '1',
    Tipo: 'E',
    SiVoto: '2',
    NoVoto: '1',
    Lista_Si: ['Abdala, Pablo D.', 'Gandini, Jorge A.'],
    Lista_No: ['Bottino, Valentina'],
    ...overrides,
  }
}

describe('cargador votaciones representantes', () => {
  it('carga votaciones matcheadas como proyectos con votos individuales', () => {
    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    // Seed legislators
    const votacionesJson = [crearVotacionJson()]
    seedLegisladoresRepresentantes(db, votacionesJson)

    // Get legislatura ID
    const leg = db
      .select()
      .from(legislaturas)
      .where(eq(legislaturas.numero, 50))
      .get()!

    // Get legislator IDs
    const legs = db.select().from(legisladores).all()
    const abdala = legs.find((l) => l.nombre === 'Abdala, Pablo D.')!
    const gandini = legs.find((l) => l.nombre === 'Gandini, Jorge A.')!
    const bottino = legs.find((l) => l.nombre === 'Bottino, Valentina')!

    // Load session via cargarSesion
    const datosSesion: DatosSesion = {
      legislaturaId: leg.id,
      camara: 'representantes',
      fecha: '2025-03-12',
      numero: 5,
      proyectos: [
        {
          nombre: 'Proyecto de ley sobre transparencia',
          votos: [
            { legisladorId: abdala.id, voto: 'afirmativo' },
            { legisladorId: gandini.id, voto: 'afirmativo' },
            { legisladorId: bottino.id, voto: 'negativo' },
          ],
          resultadoAfirmativos: 2,
          resultadoTotal: 3,
          resultado: 'afirmativa',
          unanimidad: false,
        },
      ],
    }

    cargarSesion(db, datosSesion)

    // Verify session
    const sesionDb = db
      .select()
      .from(sesiones)
      .where(eq(sesiones.camara, 'representantes'))
      .get()
    expect(sesionDb).toBeDefined()
    expect(sesionDb!.numero).toBe(5)
    expect(sesionDb!.fecha).toBe('2025-03-12')

    // Verify project
    const proyectoDb = db.select().from(proyectosLey).all()
    expect(proyectoDb).toHaveLength(1)
    expect(proyectoDb[0].nombre).toBe('Proyecto de ley sobre transparencia')
    expect(proyectoDb[0].resultadoAfirmativos).toBe(2)
    expect(proyectoDb[0].resultadoTotal).toBe(3)

    // Verify votes
    const votosDb = db.select().from(votos).all()
    expect(votosDb).toHaveLength(3)

    const votoAbdala = votosDb.find((v) => v.legisladorId === abdala.id)
    expect(votoAbdala!.voto).toBe('afirmativo')

    const votoBottino = votosDb.find((v) => v.legisladorId === bottino.id)
    expect(votoBottino!.voto).toBe('negativo')
  })

  it('maneja múltiples proyectos en una sesión', () => {
    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)
    seedPartidos(db)
    seedLegislaturas(db)

    const votacionesJson = [crearVotacionJson()]
    seedLegisladoresRepresentantes(db, votacionesJson)

    const leg = db
      .select()
      .from(legislaturas)
      .where(eq(legislaturas.numero, 50))
      .get()!

    const legs = db.select().from(legisladores).all()
    const abdala = legs.find((l) => l.nombre === 'Abdala, Pablo D.')!

    const datosSesion: DatosSesion = {
      legislaturaId: leg.id,
      camara: 'representantes',
      fecha: '2025-03-12',
      numero: 5,
      proyectos: [
        {
          nombre: 'Proyecto 1',
          votos: [{ legisladorId: abdala.id, voto: 'afirmativo' }],
          resultadoAfirmativos: 90,
          resultadoTotal: 90,
          resultado: 'afirmativa',
          unanimidad: true,
        },
        {
          nombre: 'Proyecto 2',
          votos: [{ legisladorId: abdala.id, voto: 'negativo' }],
          resultadoAfirmativos: 40,
          resultadoTotal: 95,
          resultado: 'negativa',
          unanimidad: false,
        },
      ],
    }

    cargarSesion(db, datosSesion)

    const proyectosDb = db.select().from(proyectosLey).all()
    expect(proyectosDb).toHaveLength(2)

    const votosDb = db.select().from(votos).all()
    expect(votosDb).toHaveLength(2)
  })
})
