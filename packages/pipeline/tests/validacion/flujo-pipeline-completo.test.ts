import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import {
  partidos,
  legisladores,
  legislaturas,
  sesiones,
  proyectosLey,
  votos,
} from '@como-voto-uy/shared'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { seedPartidos } from '../../src/seed/partidos.js'
import { seedLegislaturas } from '../../src/seed/legislaturas.js'
import { extraerTextoDeHtml } from '../../src/scraper/extractor-texto.js'
import { parsearTaquigrafica } from '../../src/parser/index.js'
import { buscarLegislador } from '../../src/parser/normalizador-nombres.js'
import { cargarSesion } from '../../src/loader/cargador-sesion.js'
import type { DatosSesion, DatosProyecto } from '../../src/loader/cargador-sesion.js'
import type { DB } from '../../src/db/conexion.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rutaFixture = resolve(__dirname, '../fixtures/taquigrafica-nominal.html')

let db: DB
let sqlite: ReturnType<typeof crearConexionEnMemoria>['sqlite']

// Legisladores de prueba que corresponden a nombres en la taquigráfica
const LEGISLADORES_PRUEBA = [
  { nombre: 'Carmen Asiaín', camara: 'senado' as const, sigla: 'PN' },
  { nombre: 'Jorge Batlle', camara: 'senado' as const, sigla: 'PC' },
  { nombre: 'Mario Bergara', camara: 'senado' as const, sigla: 'FA' },
  { nombre: 'Daniel Caggiani', camara: 'senado' as const, sigla: 'FA' },
  { nombre: 'Raúl Domenech', camara: 'senado' as const, sigla: 'CA' },
  { nombre: 'Guido Manini Ríos', camara: 'senado' as const, sigla: 'CA' },
  { nombre: 'Cecilia Della Ventura', camara: 'senado' as const, sigla: 'FA' },
  { nombre: 'Jorge Gandini', camara: 'senado' as const, sigla: 'PN' },
  { nombre: 'Luis Alberto Heber', camara: 'senado' as const, sigla: 'PN' },
  { nombre: 'Liliam Kechichian', camara: 'senado' as const, sigla: 'FA' },
  { nombre: 'Sandra Lazo', camara: 'senado' as const, sigla: 'FA' },
  { nombre: 'Gloria Moreira', camara: 'senado' as const, sigla: 'PN' },
]

function insertarLegisladoresPrueba() {
  const partidosPorSigla = new Map<string, number>()
  const todosPartidos = db.select().from(partidos).all()
  for (const p of todosPartidos) {
    partidosPorSigla.set(p.sigla, p.id)
  }

  const legInsertados: { id: number; nombre: string }[] = []

  for (const leg of LEGISLADORES_PRUEBA) {
    const partidoId = partidosPorSigla.get(leg.sigla)
    if (!partidoId) throw new Error(`Partido ${leg.sigla} no encontrado`)

    const insertado = db
      .insert(legisladores)
      .values({
        nombre: leg.nombre,
        partidoId,
        camara: leg.camara,
      })
      .returning()
      .get()

    legInsertados.push({ id: insertado.id, nombre: insertado.nombre })
  }

  return legInsertados
}

beforeEach(() => {
  const conexion = crearConexionEnMemoria()
  db = conexion.db
  sqlite = conexion.sqlite
  pushearSchema(sqlite)
  seedPartidos(db)
  seedLegislaturas(db)
})

afterEach(() => {
  sqlite.close()
})

describe('flujo pipeline completo: parse -> load -> query', () => {
  it('parsea fixture, carga en DB y verifica datos', () => {
    const legInsertados = insertarLegisladoresPrueba()

    // Leer y parsear la fixture
    const html = readFileSync(rutaFixture, 'utf-8')
    const texto = extraerTextoDeHtml(html)
    const parseo = parsearTaquigrafica(texto)

    // Tomar votaciones nominales
    const nominales = parseo.votaciones.filter((v) => v.tipo === 'nominal')
    expect(nominales.length).toBeGreaterThanOrEqual(1)

    // Mapear votos a legisladores
    const proyectos: DatosProyecto[] = nominales.map((votacion) => {
      const votosDb: DatosProyecto['votos'] = []

      for (const voto of votacion.votos) {
        const legisladorId = buscarLegislador(voto.nombreLegislador, legInsertados)
        if (legisladorId !== null) {
          votosDb.push({
            legisladorId,
            voto: voto.voto,
          })
        }
      }

      return {
        nombre: votacion.proyecto?.nombre || 'Votación nominal',
        votos: votosDb,
      }
    })

    // Obtener legislatura
    const leg50 = db
      .select()
      .from(legislaturas)
      .where(eq(legislaturas.numero, 49))
      .get()!

    // Cargar sesión
    const datosSesion: DatosSesion = {
      legislaturaId: leg50.id,
      camara: 'senado',
      fecha: '2023-12-19',
      numero: 55,
      proyectos,
    }

    const sesionInsertada = cargarSesion(db, datosSesion)
    expect(sesionInsertada.id).toBeDefined()

    // Verificar que la sesión existe
    const sesionDb = db
      .select()
      .from(sesiones)
      .where(eq(sesiones.id, sesionInsertada.id))
      .get()
    expect(sesionDb).toBeDefined()
    expect(sesionDb!.fecha).toBe('2023-12-19')
    expect(sesionDb!.numero).toBe(55)

    // Verificar proyectos
    const proyectosDb = db
      .select()
      .from(proyectosLey)
      .where(eq(proyectosLey.sesionId, sesionInsertada.id))
      .all()
    expect(proyectosDb.length).toBe(nominales.length)

    // Verificar votos
    const votosDb = db.select().from(votos).all()
    expect(votosDb.length).toBeGreaterThan(0)

    // Verificar que algunos legisladores tienen votos registrados
    const votosAsiaIn = sqlite
      .prepare(
        `SELECT v.voto FROM votos v
         JOIN legisladores l ON v.legislador_id = l.id
         WHERE l.nombre LIKE '%Asiaín%'`,
      )
      .all() as { voto: string }[]

    expect(votosAsiaIn.length).toBeGreaterThanOrEqual(1)
  })

  it('los votos mapeados tienen legisladores válidos', () => {
    const legInsertados = insertarLegisladoresPrueba()

    const html = readFileSync(rutaFixture, 'utf-8')
    const texto = extraerTextoDeHtml(html)
    const parseo = parsearTaquigrafica(texto)

    const nominales = parseo.votaciones.filter((v) => v.tipo === 'nominal')
    let votosMapeados = 0
    let votosNoMapeados = 0

    for (const votacion of nominales) {
      for (const voto of votacion.votos) {
        const legId = buscarLegislador(voto.nombreLegislador, legInsertados)
        if (legId !== null) {
          votosMapeados++
        } else {
          votosNoMapeados++
        }
      }
    }

    // Deberíamos poder mapear al menos algunos votos
    expect(votosMapeados).toBeGreaterThan(0)
  })

  it('la cantidad de votos por proyecto es consistente', () => {
    const legInsertados = insertarLegisladoresPrueba()

    const html = readFileSync(rutaFixture, 'utf-8')
    const texto = extraerTextoDeHtml(html)
    const parseo = parsearTaquigrafica(texto)

    const nominales = parseo.votaciones.filter((v) => v.tipo === 'nominal')

    const proyectosDatos: DatosProyecto[] = nominales.map((votacion) => {
      const votosDb: DatosProyecto['votos'] = []
      for (const voto of votacion.votos) {
        const legisladorId = buscarLegislador(voto.nombreLegislador, legInsertados)
        if (legisladorId !== null) {
          votosDb.push({ legisladorId, voto: voto.voto })
        }
      }
      return { nombre: 'Proyecto test', votos: votosDb }
    })

    const leg49 = db
      .select()
      .from(legislaturas)
      .where(eq(legislaturas.numero, 49))
      .get()!

    cargarSesion(db, {
      legislaturaId: leg49.id,
      camara: 'senado',
      fecha: '2023-12-19',
      numero: 55,
      proyectos: proyectosDatos,
    })

    // Verificar que votos por proyecto <= 31 (senado)
    const conteos = sqlite
      .prepare(
        `SELECT p.id, p.nombre, COUNT(v.id) as total
         FROM proyectos_ley p
         LEFT JOIN votos v ON v.proyecto_ley_id = p.id
         GROUP BY p.id`,
      )
      .all() as { id: number; nombre: string; total: number }[]

    for (const conteo of conteos) {
      expect(conteo.total).toBeLessThanOrEqual(31) // senado
    }
  })
})
