import { eq, and } from 'drizzle-orm'
import { legisladores, legislaturas, sesiones } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'
import { crearConexion } from '../db/conexion.js'
import { pushearSchema } from '../db/migraciones.js'
import { seedPartidos } from '../seed/partidos.js'
import { seedLegislaturas } from '../seed/legislaturas.js'
import {
  obtenerVotacionesRepresentantes,
  obtenerDiariosSesiones,
  descargarDiarioPdf,
} from '../scraper/votaciones-representantes.js'
import type { VotacionRepresentantes } from '../scraper/votaciones-representantes.js'
import {
  extraerVotacionesDiario,
  matchearVotaciones,
} from '../parser/parser-diario-representantes.js'
import type { VotacionMatcheada } from '../parser/parser-diario-representantes.js'
import { seedLegisladoresRepresentantes } from '../seed/legisladores-representantes.js'
import { cargarSesion } from './cargador-sesion.js'
import type { DatosSesion, DatosProyecto } from './cargador-sesion.js'

export interface ResultadoRepresentantes {
  sesionesNuevas: number
  sesionesOmitidas: number
  sesionesConError: number
  votacionesCargadas: number
  votosIndividuales: number
  errores: string[]
}

/**
 * Agrupa votaciones del JSON por sesión.
 */
function agruparPorSesion(
  votaciones: VotacionRepresentantes[],
): Map<number, VotacionRepresentantes[]> {
  const grupos = new Map<number, VotacionRepresentantes[]>()
  for (const v of votaciones) {
    const sesion = v.Sesion
    if (!grupos.has(sesion)) grupos.set(sesion, [])
    grupos.get(sesion)!.push(v)
  }
  return grupos
}

/**
 * Convierte fecha de formato "2025/03/12" a "2025-03-12"
 */
function normalizarFecha(fecha: string): string {
  return fecha.replace(/\//g, '-')
}

/**
 * Busca el ID de un legislador por nombre exacto.
 */
function buscarLegisladorId(
  db: DB,
  nombre: string,
): number | null {
  const leg = db
    .select({ id: legisladores.id })
    .from(legisladores)
    .where(
      and(
        eq(legisladores.nombre, nombre.trim()),
        eq(legisladores.camara, 'representantes'),
      ),
    )
    .get()

  return leg?.id ?? null
}

/**
 * Convierte votaciones matcheadas a DatosProyecto para cargar en DB.
 */
function votacionesAProyectos(
  db: DB,
  votacionesMatcheadas: VotacionMatcheada[],
): { proyectos: DatosProyecto[]; votosCount: number } {
  const proyectos: DatosProyecto[] = []
  let votosCount = 0

  for (const vm of votacionesMatcheadas) {
    const votosDb: DatosProyecto['votos'] = []

    for (const nombre of vm.listaSi) {
      const legisladorId = buscarLegisladorId(db, nombre)
      if (legisladorId) {
        votosDb.push({ legisladorId, voto: 'afirmativo' })
      }
    }

    for (const nombre of vm.listaNo) {
      const legisladorId = buscarLegisladorId(db, nombre)
      if (legisladorId) {
        votosDb.push({ legisladorId, voto: 'negativo' })
      }
    }

    votosCount += votosDb.length

    proyectos.push({
      nombre: vm.nombreProyecto,
      votos: votosDb,
      resultadoAfirmativos: vm.siVoto,
      resultadoTotal: vm.siVoto + vm.noVoto,
      resultado: vm.siVoto > vm.noVoto ? 'afirmativa' : 'negativa',
      unanimidad: vm.noVoto === 0,
    })
  }

  return { proyectos, votosCount }
}

/**
 * Ejecuta el pipeline de representantes: seed → fetch → match → load.
 */
export async function ejecutarPipelineRepresentantes(
  rutaDb: string,
): Promise<ResultadoRepresentantes> {
  const resultado: ResultadoRepresentantes = {
    sesionesNuevas: 0,
    sesionesOmitidas: 0,
    sesionesConError: 0,
    votacionesCargadas: 0,
    votosIndividuales: 0,
    errores: [],
  }

  // 1. Preparar DB
  const { db, sqlite } = crearConexion(rutaDb)
  pushearSchema(sqlite)
  seedPartidos(db)
  seedLegislaturas(db)

  // 2. Fetch votaciones JSON
  console.log('Descargando votaciones de Representantes...')
  const votacionesJson = await obtenerVotacionesRepresentantes()
  console.log(`  ${votacionesJson.length} votaciones obtenidas`)

  // 3. Seed legisladores desde JSON
  await seedLegisladoresRepresentantes(db, votacionesJson)

  // 4. Fetch diario de sesiones
  console.log('Descargando índice de diarios de sesiones...')
  const diarios = await obtenerDiariosSesiones()
  console.log(`  ${diarios.length} diarios indexados`)

  // 5. Obtener legislatura ID
  const legislatura = db
    .select()
    .from(legislaturas)
    .where(eq(legislaturas.numero, 50))
    .get()

  if (!legislatura) {
    throw new Error('Legislatura 50 no encontrada en la base de datos')
  }

  // 6. Procesar por sesión
  const porSesion = agruparPorSesion(votacionesJson)
  console.log(`  ${porSesion.size} sesiones con votaciones electrónicas`)

  for (const [numSesion, votsSesion] of porSesion) {
    const fecha = normalizarFecha(votsSesion[0].SesionFecha)

    // Verificar si ya existe
    const sesionExistente = db
      .select()
      .from(sesiones)
      .where(
        and(
          eq(sesiones.legislaturaId, legislatura.id),
          eq(sesiones.camara, 'representantes'),
          eq(sesiones.numero, numSesion),
        ),
      )
      .get()

    if (sesionExistente) {
      console.log(`  Sesión ${numSesion} ya existe, omitiendo.`)
      resultado.sesionesOmitidas++
      continue
    }

    try {
      console.log(`  Procesando sesión ${numSesion} (${fecha}, ${votsSesion.length} votaciones)...`)

      // Buscar diario PDF para esta sesión
      const diario = diarios.find((d) => d.Sesion === numSesion)
      let votacionesMatcheadas: VotacionMatcheada[]

      if (diario) {
        try {
          console.log(`    Descargando diario ${diario.Diario} (${diario.URL})...`)
          const textoPdf = await descargarDiarioPdf(diario.URL)
          const votacionesDiario = extraerVotacionesDiario(textoPdf)
          console.log(`    ${votacionesDiario.length} votaciones encontradas en el diario`)
          votacionesMatcheadas = matchearVotaciones(votsSesion, votacionesDiario)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          console.warn(`    Error descargando diario: ${msg}. Usando nombres genéricos.`)
          votacionesMatcheadas = votsSesion.map((v) => ({
            sesion: v.Sesion,
            fecha: v.SesionFecha,
            votacionNumero: v.Votacion,
            siVoto: parseInt(v.SiVoto, 10),
            noVoto: parseInt(v.NoVoto, 10),
            listaSi: v.Lista_Si,
            listaNo: v.Lista_No,
            nombreProyecto: `Votación ${v.Votacion}`,
          }))
        }
      } else {
        console.log(`    No se encontró diario para sesión ${numSesion}. Usando nombres genéricos.`)
        votacionesMatcheadas = votsSesion.map((v) => ({
          sesion: v.Sesion,
          fecha: v.SesionFecha,
          votacionNumero: v.Votacion,
          siVoto: parseInt(v.SiVoto, 10),
          noVoto: parseInt(v.NoVoto, 10),
          listaSi: v.Lista_Si,
          listaNo: v.Lista_No,
          nombreProyecto: `Votación ${v.Votacion}`,
        }))
      }

      // Convertir a datos de sesión y cargar
      const { proyectos, votosCount } = votacionesAProyectos(db, votacionesMatcheadas)

      const datosSesion: DatosSesion = {
        legislaturaId: legislatura.id,
        camara: 'representantes',
        fecha,
        numero: numSesion,
        proyectos,
      }

      cargarSesion(db, datosSesion)

      resultado.sesionesNuevas++
      resultado.votacionesCargadas += votacionesMatcheadas.length
      resultado.votosIndividuales += votosCount
      console.log(`    Cargada: ${proyectos.length} proyectos, ${votosCount} votos individuales`)
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error)
      console.error(`    Error procesando sesión ${numSesion}: ${mensaje}`)
      resultado.errores.push(`Sesión ${numSesion}: ${mensaje}`)
      resultado.sesionesConError++
    }
  }

  // 7. Resumen
  console.log('\n--- Resultado pipeline Representantes ---')
  console.log(`Sesiones nuevas: ${resultado.sesionesNuevas}`)
  console.log(`Sesiones omitidas: ${resultado.sesionesOmitidas}`)
  console.log(`Sesiones con error: ${resultado.sesionesConError}`)
  console.log(`Votaciones cargadas: ${resultado.votacionesCargadas}`)
  console.log(`Votos individuales: ${resultado.votosIndividuales}`)

  sqlite.close()
  return resultado
}
