import { describe, it, expect, beforeEach } from 'vitest'
import { crearConexionEnMemoria } from '../src/db/conexion.js'
import { pushearSchema } from '../src/db/migraciones.js'
import { partidos, legisladores, sesiones, legislaturas, proyectosLey, votos } from '@como-voto-uy/shared'
import { eq, desc, count, sql } from 'drizzle-orm'
import { cargarSesion } from '../src/loader/cargador-sesion.js'
import type { DatosSesion } from '../src/loader/cargador-sesion.js'
import type { DB } from '../src/db/conexion.js'
import type Database from 'better-sqlite3'

let db: DB
let sqlite: Database.Database

function seedDatosBase() {
  db.insert(partidos).values([
    { id: 1, nombre: 'Frente Amplio', sigla: 'FA', color: '#2A52BE' },
    { id: 2, nombre: 'Partido Nacional', sigla: 'PN', color: '#0072CE' },
  ]).run()

  db.insert(legisladores).values([
    { id: 1, nombre: 'Andrade, Oscar', partidoId: 1, camara: 'senado' },
    { id: 2, nombre: 'Bianchi, Graciela', partidoId: 2, camara: 'senado' },
  ]).run()

  db.insert(legislaturas).values([
    { id: 1, numero: 50, fechaInicio: '2025-03-01' },
  ]).run()
}

beforeEach(() => {
  const conexion = crearConexionEnMemoria()
  db = conexion.db
  sqlite = conexion.sqlite
  pushearSchema(sqlite)
  seedDatosBase()
})

describe('resultados agregados en proyectos_ley', () => {
  it('almacena resultado agregado afirmativo', () => {
    const datosSesion: DatosSesion = {
      legislaturaId: 1,
      camara: 'senado',
      fecha: '2025-04-01',
      numero: 1,
      proyectos: [{
        nombre: 'Proyecto de ley por el que se aprueba presupuesto',
        votos: [],
        resultadoAfirmativos: 26,
        resultadoTotal: 31,
        resultado: 'afirmativa',
        unanimidad: false,
      }],
    }

    cargarSesion(db, datosSesion)

    const proyecto = db.select().from(proyectosLey).get()!
    expect(proyecto.resultadoAfirmativos).toBe(26)
    expect(proyecto.resultadoTotal).toBe(31)
    expect(proyecto.resultado).toBe('afirmativa')
    expect(proyecto.unanimidad).toBe(false)
  })

  it('almacena resultado negativo', () => {
    const datosSesion: DatosSesion = {
      legislaturaId: 1,
      camara: 'senado',
      fecha: '2025-04-01',
      numero: 2,
      proyectos: [{
        nombre: 'Moción rechazada',
        votos: [],
        resultadoAfirmativos: 12,
        resultadoTotal: 31,
        resultado: 'negativa',
        unanimidad: false,
      }],
    }

    cargarSesion(db, datosSesion)

    const proyecto = db.select().from(proyectosLey).get()!
    expect(proyecto.resultadoAfirmativos).toBe(12)
    expect(proyecto.resultadoTotal).toBe(31)
    expect(proyecto.resultado).toBe('negativa')
  })

  it('almacena unanimidad', () => {
    const datosSesion: DatosSesion = {
      legislaturaId: 1,
      camara: 'senado',
      fecha: '2025-04-01',
      numero: 3,
      proyectos: [{
        nombre: 'Aprobado por unanimidad',
        votos: [],
        resultadoAfirmativos: 31,
        resultadoTotal: 31,
        resultado: 'afirmativa',
        unanimidad: true,
      }],
    }

    cargarSesion(db, datosSesion)

    const proyecto = db.select().from(proyectosLey).get()!
    expect(proyecto.unanimidad).toBe(true)
  })

  it('almacena proyecto con votos individuales Y resultado agregado', () => {
    const datosSesion: DatosSesion = {
      legislaturaId: 1,
      camara: 'senado',
      fecha: '2025-04-01',
      numero: 4,
      proyectos: [{
        nombre: 'Votación nominal con resultado',
        votos: [
          { legisladorId: 1, voto: 'afirmativo' },
          { legisladorId: 2, voto: 'negativo' },
        ],
        resultadoAfirmativos: 18,
        resultadoTotal: 31,
        resultado: 'afirmativa',
        unanimidad: false,
      }],
    }

    cargarSesion(db, datosSesion)

    const proyecto = db.select().from(proyectosLey).get()!
    expect(proyecto.resultadoAfirmativos).toBe(18)
    expect(proyecto.resultado).toBe('afirmativa')

    const votosIndividuales = db.select().from(votos).all()
    expect(votosIndividuales).toHaveLength(2)
  })

  it('permite proyectos sin resultado agregado (null)', () => {
    const datosSesion: DatosSesion = {
      legislaturaId: 1,
      camara: 'senado',
      fecha: '2025-04-01',
      numero: 5,
      proyectos: [{
        nombre: 'Proyecto sin resultado claro',
        votos: [],
      }],
    }

    cargarSesion(db, datosSesion)

    const proyecto = db.select().from(proyectosLey).get()!
    expect(proyecto.resultadoAfirmativos).toBeNull()
    expect(proyecto.resultadoTotal).toBeNull()
    expect(proyecto.resultado).toBeNull()
    expect(proyecto.unanimidad).toBeNull()
  })
})

describe('consultas del frontend con resultados agregados', () => {
  beforeEach(() => {
    // Insertar sesión con mix de proyectos
    const datosSesion: DatosSesion = {
      legislaturaId: 1,
      camara: 'senado',
      fecha: '2025-04-01',
      numero: 1,
      proyectos: [
        {
          nombre: 'Levantamiento del receso',
          votos: [],
          resultadoAfirmativos: 28,
          resultadoTotal: 28,
          resultado: 'afirmativa',
          unanimidad: false,
        },
        {
          nombre: 'Solicitudes de licencia',
          votos: [],
          resultadoAfirmativos: 25,
          resultadoTotal: 28,
          resultado: 'afirmativa',
          unanimidad: false,
        },
        {
          nombre: 'Moción rechazada',
          votos: [],
          resultadoAfirmativos: 10,
          resultadoTotal: 28,
          resultado: 'negativa',
          unanimidad: false,
        },
      ],
    }
    cargarSesion(db, datosSesion)
  })

  it('obtenerLeyesRecientes devuelve resultados agregados', () => {
    const resultado = db
      .select({
        id: proyectosLey.id,
        nombre: proyectosLey.nombre,
        fecha: sesiones.fecha,
        camara: sesiones.camara,
        resultadoAfirmativos: proyectosLey.resultadoAfirmativos,
        resultadoTotal: proyectosLey.resultadoTotal,
        resultado: proyectosLey.resultado,
        unanimidad: proyectosLey.unanimidad,
      })
      .from(proyectosLey)
      .innerJoin(sesiones, eq(proyectosLey.sesionId, sesiones.id))
      .orderBy(desc(sesiones.fecha))
      .limit(10)
      .all()

    expect(resultado).toHaveLength(3)

    const receso = resultado.find((r) => r.nombre === 'Levantamiento del receso')!
    expect(receso.resultadoAfirmativos).toBe(28)
    expect(receso.resultadoTotal).toBe(28)
    expect(receso.resultado).toBe('afirmativa')

    const rechazada = resultado.find((r) => r.nombre === 'Moción rechazada')!
    expect(rechazada.resultadoAfirmativos).toBe(10)
    expect(rechazada.resultado).toBe('negativa')
  })

  it('la página de ley muestra resultado agregado cuando no hay votos individuales', () => {
    // Simular la query de la página /ley/[id]
    const proyectoId = db.select({ id: proyectosLey.id }).from(proyectosLey).get()!.id

    // Query del proyecto (como hace obtenerProyecto)
    const proyecto = db
      .select({
        id: proyectosLey.id,
        nombre: proyectosLey.nombre,
        resultadoAfirmativos: proyectosLey.resultadoAfirmativos,
        resultadoTotal: proyectosLey.resultadoTotal,
        resultado: proyectosLey.resultado,
        unanimidad: proyectosLey.unanimidad,
      })
      .from(proyectosLey)
      .where(eq(proyectosLey.id, proyectoId))
      .get()!

    // Query de votos individuales (como hace obtenerVotosPorProyecto)
    const votosIndividuales = db
      .select()
      .from(votos)
      .where(eq(votos.proyectoLeyId, proyectoId))
      .all()

    // No hay votos individuales
    expect(votosIndividuales).toHaveLength(0)

    // Pero SÍ hay resultado agregado
    expect(proyecto.resultado).toBe('afirmativa')
    expect(proyecto.resultadoAfirmativos).toBe(28)
    expect(proyecto.resultadoTotal).toBe(28)
  })

  it('no muestra 0/0/0 para proyectos sin votos individuales', () => {
    const proyectos = db.select().from(proyectosLey).all()

    for (const proyecto of proyectos) {
      const votosIndividuales = db
        .select()
        .from(votos)
        .where(eq(votos.proyectoLeyId, proyecto.id))
        .all()

      if (votosIndividuales.length === 0) {
        // Sin votos individuales, el frontend debe usar resultado agregado
        expect(proyecto.resultado).not.toBeNull()
        expect(proyecto.resultadoAfirmativos).not.toBeNull()
        expect(proyecto.resultadoTotal).not.toBeNull()
        expect(proyecto.resultadoAfirmativos).toBeGreaterThan(0)
        expect(proyecto.resultadoTotal).toBeGreaterThan(0)
      }
    }
  })
})

describe('extracción de resultados agregados del parser', () => {
  it('extrae resultado numérico', async () => {
    const { extraerResultadoAgregado } = await import('../src/parser/extractor-votos.js')

    const resultado = extraerResultadoAgregado('–26 en 31. Afirmativa.')
    expect(resultado).not.toBeNull()
    expect(resultado!.afirmativos).toBe(26)
    expect(resultado!.total).toBe(31)
    expect(resultado!.resultado).toBe('afirmativa')
    expect(resultado!.unanimidad).toBe(false)
  })

  it('extrae unanimidad', async () => {
    const { extraerResultadoAgregado } = await import('../src/parser/extractor-votos.js')

    const resultado = extraerResultadoAgregado('–31 en 31. Afirmativa. UNANIMIDAD.')
    expect(resultado).not.toBeNull()
    expect(resultado!.unanimidad).toBe(true)
  })

  it('extrae resultado negativo', async () => {
    const { extraerResultadoAgregado } = await import('../src/parser/extractor-votos.js')

    const resultado = extraerResultadoAgregado('–13 en 31. Negativa.')
    expect(resultado).not.toBeNull()
    expect(resultado!.resultado).toBe('negativa')
    expect(resultado!.afirmativos).toBe(13)
  })

  it('retorna null para texto sin resultado', async () => {
    const { extraerResultadoAgregado } = await import('../src/parser/extractor-votos.js')

    const resultado = extraerResultadoAgregado('Se va a votar nominalmente.')
    expect(resultado).toBeNull()
  })
})
