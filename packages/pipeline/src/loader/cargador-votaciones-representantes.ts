import { and, eq } from 'drizzle-orm'
import {
  legisladores,
  legislaturas,
  sesiones,
} from '@como-voto-uy/shared'
import { crearConexion } from '../db/conexion.js'
import type { DB } from '../db/conexion.js'
import { pushearSchema } from '../db/migraciones.js'
import { cargarSesion } from './cargador-sesion.js'
import type { DatosSesion, DatosVotacion } from './cargador-sesion.js'
import {
  extraerVotacionesDiario,
  matchearVotaciones,
} from '../parser/parser-diario-representantes.js'
import type { VotacionMatcheada } from '../parser/parser-diario-representantes.js'
import { seedLegisladoresRepresentantes } from '../seed/legisladores-representantes.js'
import { seedLegislaturas } from '../seed/legislaturas.js'
import { seedPartidos } from '../seed/partidos.js'
import {
  descargarDiarioPdf,
  obtenerDiariosSesiones,
  obtenerVotacionesRepresentantes,
} from '../scraper/votaciones-representantes.js'
import type { VotacionRepresentantes } from '../scraper/votaciones-representantes.js'

function agruparPorSesion(
  votaciones: VotacionRepresentantes[],
): Map<number, VotacionRepresentantes[]> {
  const grupos = new Map<number, VotacionRepresentantes[]>()
  for (const votacion of votaciones) {
    const grupo = grupos.get(votacion.Sesion) ?? []
    grupo.push(votacion)
    grupos.set(votacion.Sesion, grupo)
  }
  return grupos
}

function normalizarFecha(fecha: string): string {
  return fecha.replace(/\//g, '-')
}

function buscarLegisladorId(db: DB, nombre: string): number | null {
  const legislador = db
    .select({ id: legisladores.id })
    .from(legisladores)
    .where(
      and(
        eq(legisladores.nombre, nombre.trim()),
        eq(legisladores.camara, 'representantes'),
      ),
    )
    .get()

  return legislador?.id ?? null
}

export function votacionesAModeloNuevo(
  db: DB,
  votacionesMatcheadas: VotacionMatcheada[],
): { votaciones: DatosVotacion[]; votosCount: number } {
  let votosCount = 0

  const votaciones = votacionesMatcheadas.map((vm, indice) => {
    const votosIndividuales = [
      ...vm.listaSi
        .map((nombre) => buscarLegisladorId(db, nombre))
        .filter((id): id is number => id !== null)
        .map((legisladorId) => ({
          legisladorId,
          voto: 'afirmativo' as const,
          nivelConfianza: 'confirmado' as const,
          esOficial: true,
        })),
      ...vm.listaNo
        .map((nombre) => buscarLegisladorId(db, nombre))
        .filter((id): id is number => id !== null)
        .map((legisladorId) => ({
          legisladorId,
          voto: 'negativo' as const,
          nivelConfianza: 'confirmado' as const,
          esOficial: true,
        })),
    ]

    votosCount += votosIndividuales.length

    const nombreGenerico = /^Votación\s+\d+$/i.test(vm.nombreProyecto)
    const asunto = nombreGenerico
      ? null
      : {
          nombre: vm.nombreProyecto,
        }

    return {
      asunto,
      ordenSesion: indice + 1,
      modalidad: 'electronica' as const,
      estadoCobertura: 'individual_confirmado' as const,
      nivelConfianza: nombreGenerico ? 'medio' : 'alto',
      esOficial: true,
      resultado: vm.siVoto > vm.noVoto ? 'afirmativa' : 'negativa',
      fuentePrincipal: {
        tipo: 'json' as const,
        url: 'https://documentos.diputados.gub.uy/docs/DAvotaciones.json',
      },
      votosIndividuales,
      resultadoAgregado: {
        afirmativos: vm.siVoto,
        negativos: vm.noVoto,
        totalPresentes: vm.siVoto + vm.noVoto,
        unanimidad: vm.noVoto === 0,
        resultado: vm.siVoto > vm.noVoto ? 'afirmativa' : 'negativa',
      },
      evidencias: nombreGenerico
        ? []
        : [
            {
              tipo: 'texto' as const,
              texto: vm.nombreProyecto,
              detalle: 'Nombre de asunto inferido desde el diario de sesiones',
            },
          ],
    } satisfies DatosVotacion
  })

  return { votaciones, votosCount }
}

export interface ResultadoRepresentantes {
  sesionesNuevas: number
  sesionesOmitidas: number
  sesionesConError: number
  votacionesCargadas: number
  votosIndividuales: number
  errores: string[]
}

export async function ejecutarPipelineRepresentantes(
  rutaDb: string,
  opciones?: { resetearDb?: boolean },
): Promise<ResultadoRepresentantes> {
  const resultado: ResultadoRepresentantes = {
    sesionesNuevas: 0,
    sesionesOmitidas: 0,
    sesionesConError: 0,
    votacionesCargadas: 0,
    votosIndividuales: 0,
    errores: [],
  }

  const { db, sqlite } = crearConexion(rutaDb)
  if (opciones?.resetearDb ?? true) {
    pushearSchema(sqlite)
  }
  seedPartidos(db)
  seedLegislaturas(db)

  const votacionesJson = await obtenerVotacionesRepresentantes()
  await seedLegisladoresRepresentantes(db, votacionesJson)

  const diarios = await obtenerDiariosSesiones()
  const legislatura = db
    .select({ id: legislaturas.id })
    .from(legislaturas)
    .where(eq(legislaturas.numero, 50))
    .get()

  if (!legislatura) {
    throw new Error('Legislatura 50 no encontrada')
  }

  const porSesion = agruparPorSesion(votacionesJson)

  for (const [numeroSesion, votacionesSesion] of porSesion) {
    const sesionExistente = db
      .select({ id: sesiones.id })
      .from(sesiones)
      .where(
        and(
          eq(sesiones.legislaturaId, legislatura.id),
          eq(sesiones.cuerpo, 'representantes'),
          eq(sesiones.numero, numeroSesion),
        ),
      )
      .get()

    if (sesionExistente) {
      resultado.sesionesOmitidas++
      continue
    }

    try {
      const fecha = normalizarFecha(votacionesSesion[0].SesionFecha)
      const diario = diarios.find((item) => item.Sesion === numeroSesion)

      let votacionesMatcheadas: VotacionMatcheada[]
      if (diario) {
        try {
          const textoPdf = await descargarDiarioPdf(diario.URL)
          const votacionesDiario = extraerVotacionesDiario(textoPdf)
          votacionesMatcheadas = matchearVotaciones(votacionesSesion, votacionesDiario)
        } catch {
          votacionesMatcheadas = votacionesSesion.map((votacion) => ({
            sesion: votacion.Sesion,
            fecha: votacion.SesionFecha,
            votacionNumero: votacion.Votacion,
            siVoto: parseInt(votacion.SiVoto, 10),
            noVoto: parseInt(votacion.NoVoto, 10),
            listaSi: votacion.Lista_Si,
            listaNo: votacion.Lista_No,
            nombreProyecto: `Votación ${votacion.Votacion}`,
          }))
        }
      } else {
        votacionesMatcheadas = votacionesSesion.map((votacion) => ({
          sesion: votacion.Sesion,
          fecha: votacion.SesionFecha,
          votacionNumero: votacion.Votacion,
          siVoto: parseInt(votacion.SiVoto, 10),
          noVoto: parseInt(votacion.NoVoto, 10),
          listaSi: votacion.Lista_Si,
          listaNo: votacion.Lista_No,
          nombreProyecto: `Votación ${votacion.Votacion}`,
        }))
      }

      const { votaciones, votosCount } = votacionesAModeloNuevo(db, votacionesMatcheadas)

      const datosSesion: DatosSesion = {
        legislaturaId: legislatura.id,
        cuerpo: 'representantes',
        fecha,
        numero: numeroSesion,
        fuente: {
          tipo: 'json',
          url: 'https://documentos.diputados.gub.uy/docs/DAvotaciones.json',
        },
        votaciones,
      }

      cargarSesion(db, datosSesion)

      resultado.sesionesNuevas++
      resultado.votacionesCargadas += votaciones.length
      resultado.votosIndividuales += votosCount
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error)
      resultado.sesionesConError++
      resultado.errores.push(`Sesión ${numeroSesion}: ${mensaje}`)
    }
  }

  sqlite.close()
  return resultado
}
