import { and, eq } from 'drizzle-orm'
import { legisladores, legislaturas, sesiones } from '@como-voto-uy/shared'
import { crearConexion } from '../db/conexion.js'
import type { DB } from '../db/conexion.js'
import { pushearSchema } from '../db/migraciones.js'
import { cargarSesion } from './cargador-sesion.js'
import type { DatosSesion, DatosVotacion } from './cargador-sesion.js'
import { canonizarAsunto } from '../parser/canonizador-asuntos.js'
import {
  extraerVotacionesDiario,
  matchearVotaciones,
} from '../parser/parser-diario-representantes.js'
import type { VotacionMatcheada } from '../parser/parser-diario-representantes.js'
import {
  reconciliarLegisladoresSinAsignar,
  seedLegisladoresRepresentantes,
} from '../seed/legisladores-representantes.js'
import { seedLegislaturas } from '../seed/legislaturas.js'
import { seedPartidos } from '../seed/partidos.js'
import {
  descargarDiarioPdf,
  obtenerDiariosSesiones,
  obtenerPadronRepresentantes,
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

function buscarLegisladorId(db: DB, nombre: string, legislaturaId: number): number | null {
  const legislador = db
    .select({ id: legisladores.id })
    .from(legisladores)
    .where(
      and(
        eq(legisladores.nombre, nombre.trim()),
        eq(legisladores.legislaturaId, legislaturaId),
        eq(legisladores.camara, 'representantes'),
      ),
    )
    .get()

  return legislador?.id ?? null
}

export function votacionesAModeloNuevo(
  db: DB,
  legislaturaId: number,
  votacionesMatcheadas: VotacionMatcheada[],
): { votaciones: DatosVotacion[]; votosCount: number } {
  let votosCount = 0

  const votaciones = votacionesMatcheadas.map((votacionMatcheada, indice) => {
    const asuntoCanonico = canonizarAsunto({
      nombreCrudo: votacionMatcheada.nombreProyecto,
      textoContexto: votacionMatcheada.textoContexto,
      carpeta: votacionMatcheada.carpeta,
      repartido: votacionMatcheada.repartido,
      tipoAsunto: 'proyecto_ley',
    })

    const votosIndividuales = [
      ...votacionMatcheada.listaSi
        .map((nombre) => buscarLegisladorId(db, nombre, legislaturaId))
        .filter((id): id is number => id !== null)
        .map((legisladorId) => ({
          legisladorId,
          voto: 'afirmativo' as const,
          nivelConfianza: 'confirmado' as const,
          esOficial: true,
        })),
      ...votacionMatcheada.listaNo
        .map((nombre) => buscarLegisladorId(db, nombre, legislaturaId))
        .filter((id): id is number => id !== null)
        .map((legisladorId) => ({
          legisladorId,
          voto: 'negativo' as const,
          nivelConfianza: 'confirmado' as const,
          esOficial: true,
        })),
    ]

    votosCount += votosIndividuales.length

    return {
      asunto: {
        nombre: asuntoCanonico.nombre,
        calidadTitulo: asuntoCanonico.calidadTitulo,
        descripcion: asuntoCanonico.descripcion,
        carpeta: votacionMatcheada.carpeta,
        repartido: votacionMatcheada.repartido,
        tipoAsunto: asuntoCanonico.tipoAsunto ?? 'proyecto_ley',
        codigoOficial:
          votacionMatcheada.carpeta && votacionMatcheada.repartido
            ? `${votacionMatcheada.carpeta}-${votacionMatcheada.repartido}`
            : votacionMatcheada.carpeta,
      },
      ordenSesion: indice + 1,
      modalidad: 'electronica' as const,
      estadoCobertura: 'individual_confirmado' as const,
      nivelConfianza: asuntoCanonico.calidadTitulo === 'canonico' ? 'alto' : 'medio',
      esOficial: true,
      resultado: votacionMatcheada.siVoto > votacionMatcheada.noVoto ? 'afirmativa' : 'negativa',
      fuentePrincipal: {
        tipo: 'json' as const,
        url: 'https://documentos.diputados.gub.uy/docs/DAvotaciones.json',
      },
      votosIndividuales,
      resultadoAgregado: {
        afirmativos: votacionMatcheada.siVoto,
        negativos: votacionMatcheada.noVoto,
        totalPresentes: votacionMatcheada.siVoto + votacionMatcheada.noVoto,
        unanimidad: votacionMatcheada.noVoto === 0,
        resultado:
          votacionMatcheada.siVoto > votacionMatcheada.noVoto ? 'afirmativa' : 'negativa',
      },
      evidencias: votacionMatcheada.textoContexto
        ? [
            {
              tipo: 'texto' as const,
              texto: votacionMatcheada.textoContexto,
              detalle: 'Título y contexto inferidos desde el diario de sesiones',
            },
          ]
        : [],
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
  legisladoresReconciliados: number
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
    legisladoresReconciliados: 0,
    errores: [],
  }

  const { db, sqlite } = crearConexion(rutaDb)
  if (opciones?.resetearDb ?? true) {
    pushearSchema(sqlite)
  }
  seedPartidos(db)
  seedLegislaturas(db)

  const votacionesJson = await obtenerVotacionesRepresentantes()
  const padron = await obtenerPadronRepresentantes().catch(() => [])
  await seedLegisladoresRepresentantes(db, votacionesJson, padron)

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
            nombreProyecto: `Asunto de sesión ${votacion.Sesion} votación ${votacion.Votacion}`,
            calidadTitulo: 'incompleto',
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
          nombreProyecto: `Asunto de sesión ${votacion.Sesion} votación ${votacion.Votacion}`,
          calidadTitulo: 'incompleto',
        }))
      }

      const { votaciones, votosCount } = votacionesAModeloNuevo(
        db,
        legislatura.id,
        votacionesMatcheadas,
      )

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

  resultado.legisladoresReconciliados = reconciliarLegisladoresSinAsignar(db, legislatura.id)

  sqlite.close()
  return resultado
}
