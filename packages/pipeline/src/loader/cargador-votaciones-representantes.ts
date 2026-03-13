import { and, eq } from 'drizzle-orm'
import { legislaturas, sesiones } from '@como-voto-uy/shared'
import { crearConexion } from '../db/conexion.js'
import type { DB } from '../db/conexion.js'
import { pushearSchema } from '../db/migraciones.js'
import {
  cargarAfiliacionesHistoricas,
  reconciliarAfiliacionesPorAlias,
  resolverLegisladorPorContexto,
} from './cargador-afiliaciones.js'
import { cargarSesion } from './cargador-sesion.js'
import type { DatosSesion, DatosVotacion } from './cargador-sesion.js'
import { canonizarAsunto, esTituloSubordinado } from '../parser/canonizador-asuntos.js'
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

function buscarLegisladorId(db: DB, nombre: string, legislaturaId: number): number | null {
  return resolverLegisladorPorContexto(db, nombre.trim(), legislaturaId, 'representantes')
}

function deduplicarVotosIndividuales(
  votos: Array<{
    legisladorId: number
    voto: 'afirmativo' | 'negativo'
    nivelConfianza: 'confirmado'
    esOficial: true
  }>,
) {
  const mapa = new Map<number, (typeof votos)[number]>()
  for (const voto of votos) {
    if (!mapa.has(voto.legisladorId)) {
      mapa.set(voto.legisladorId, voto)
    }
  }
  return [...mapa.values()]
}

function normalizarSlugTitulo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function tieneTituloPublicoAprovechable(
  asuntoCanonico: ReturnType<typeof canonizarAsunto>,
): boolean {
  const titulo = asuntoCanonico.tituloPublico.trim()
  return (
    titulo.length >= 12 &&
    !/^asunto sin t[íi]tulo identificable$/i.test(titulo) &&
    !/^votaci[oó]n sin asunto identificado/i.test(titulo) &&
    !/^proyecto de ley$/i.test(titulo)
  )
}

function esAsuntoAncla(asuntoCanonico: ReturnType<typeof canonizarAsunto>): boolean {
  return (
    asuntoCanonico.calidadTitulo !== 'incompleto' || tieneTituloPublicoAprovechable(asuntoCanonico)
  )
}

function construirCodigoAsuntoRepresentantes(
  votacionMatcheada: VotacionMatcheada,
  asuntoCanonico: ReturnType<typeof canonizarAsunto>,
) {
  if (votacionMatcheada.carpeta && votacionMatcheada.repartido) {
    return `${votacionMatcheada.carpeta}-${votacionMatcheada.repartido}`
  }
  if (votacionMatcheada.carpeta) {
    return votacionMatcheada.carpeta
  }
  if (tieneTituloPublicoAprovechable(asuntoCanonico)) {
    const slug = normalizarSlugTitulo(asuntoCanonico.tituloPublico)
    if (slug) {
      return `rep-l50-${slug}`
    }
  }
  return `rep-l50-s${votacionMatcheada.sesion}-v${votacionMatcheada.votacionNumero}`
}

function completarAsuntoDebil(
  asuntoCanonico: ReturnType<typeof canonizarAsunto>,
  votacionMatcheada: VotacionMatcheada,
) {
  if (
    asuntoCanonico.calidadTitulo !== 'incompleto' ||
    tieneTituloPublicoAprovechable(asuntoCanonico) ||
    votacionMatcheada.carpeta ||
    votacionMatcheada.repartido
  ) {
    return asuntoCanonico
  }

  const identificador = `Votación sin asunto identificado · Sesión ${votacionMatcheada.sesion} · N.º ${votacionMatcheada.votacionNumero}`
  return {
    ...asuntoCanonico,
    nombre: identificador,
    tituloPublico: identificador,
  }
}

function propagarAsuntosCanonicosEntreHuecos(
  asuntos: Array<{
    asuntoCanonico: ReturnType<typeof canonizarAsunto>
    codigoOficial: string
  }>,
) {
  for (let indice = 0; indice < asuntos.length; indice++) {
    const actual = asuntos[indice]
    if (esAsuntoAncla(actual.asuntoCanonico)) continue

    let anteriorCanonico: (typeof asuntos)[number] | null = null
    for (let cursor = indice - 1; cursor >= 0; cursor--) {
      if (esAsuntoAncla(asuntos[cursor].asuntoCanonico)) {
        anteriorCanonico = asuntos[cursor]
        break
      }
    }

    let siguienteCanonico: (typeof asuntos)[number] | null = null
    for (let cursor = indice + 1; cursor < asuntos.length; cursor++) {
      if (esAsuntoAncla(asuntos[cursor].asuntoCanonico)) {
        siguienteCanonico = asuntos[cursor]
        break
      }
    }

    if (
      anteriorCanonico &&
      siguienteCanonico &&
      anteriorCanonico.codigoOficial === siguienteCanonico.codigoOficial
    ) {
      asuntos[indice] = {
        asuntoCanonico: {
          ...anteriorCanonico.asuntoCanonico,
          descripcion:
            actual.asuntoCanonico.descripcion ?? anteriorCanonico.asuntoCanonico.descripcion,
        },
        codigoOficial: anteriorCanonico.codigoOficial,
      }
    }
  }

  return asuntos
}

export function votacionesAModeloNuevo(
  db: DB,
  legislaturaId: number,
  votacionesMatcheadas: VotacionMatcheada[],
): { votaciones: DatosVotacion[]; votosCount: number } {
  let votosCount = 0
  let ultimoAsuntoPrincipal: ReturnType<typeof canonizarAsunto> | null = null
  let ultimoCodigoPrincipal: string | null = null

  const asuntosResueltos = propagarAsuntosCanonicosEntreHuecos(
    votacionesMatcheadas.map((votacionMatcheada) => {
      const asuntoCanonicoBase = canonizarAsunto({
        nombreCrudo: votacionMatcheada.nombreProyecto,
        textoContexto: votacionMatcheada.textoContexto,
        carpeta: votacionMatcheada.carpeta,
        repartido: votacionMatcheada.repartido,
        tipoAsunto: 'proyecto_ley',
      })
      const asuntoCanonicoIntermedio = completarAsuntoDebil(
        asuntoCanonicoBase,
        votacionMatcheada,
      )
      const textoCandidatoCrudo =
        votacionMatcheada.tituloPublico || votacionMatcheada.nombreProyecto || ''
      const heredaAsuntoPrincipal =
        ultimoAsuntoPrincipal &&
        (esTituloSubordinado(asuntoCanonicoIntermedio.tituloPublico) ||
          esTituloSubordinado(textoCandidatoCrudo))
      const asuntoCanonico = heredaAsuntoPrincipal
        ? {
            ...ultimoAsuntoPrincipal,
            descripcion:
              asuntoCanonicoIntermedio.descripcion ?? ultimoAsuntoPrincipal.descripcion,
          }
        : asuntoCanonicoIntermedio

      const codigoOficial =
        heredaAsuntoPrincipal && ultimoCodigoPrincipal
          ? ultimoCodigoPrincipal
          : construirCodigoAsuntoRepresentantes(votacionMatcheada, asuntoCanonico)

      if (esAsuntoAncla(asuntoCanonico) && !esTituloSubordinado(asuntoCanonico.tituloPublico)) {
        ultimoAsuntoPrincipal = asuntoCanonico
        ultimoCodigoPrincipal = codigoOficial
      }

      return {
        asuntoCanonico,
        codigoOficial,
      }
    }),
  )

  const votaciones = votacionesMatcheadas.map((votacionMatcheada, indice) => {
    const asuntoResuelto = asuntosResueltos[indice]
    const asuntoCanonico = asuntoResuelto.asuntoCanonico
    const asuntoCanonicoBase = canonizarAsunto({
      nombreCrudo: votacionMatcheada.nombreProyecto,
      textoContexto: votacionMatcheada.textoContexto,
      carpeta: votacionMatcheada.carpeta,
      repartido: votacionMatcheada.repartido,
      tipoAsunto: 'proyecto_ley',
    })

    const votosIndividuales = deduplicarVotosIndividuales([
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
    ])

    votosCount += votosIndividuales.length

    return {
      asunto: {
        nombre: asuntoCanonico.nombre,
        tituloPublico: asuntoCanonico.tituloPublico,
        origenTitulo: asuntoCanonico.origenTitulo,
        calidadTitulo: asuntoCanonico.calidadTitulo,
        descripcion: asuntoCanonico.descripcion,
        carpeta: votacionMatcheada.carpeta,
        repartido: votacionMatcheada.repartido,
        tipoAsunto: asuntoCanonico.tipoAsunto ?? 'proyecto_ley',
        codigoOficial: asuntoResuelto.codigoOficial,
      },
      ordenSesion: indice + 1,
      modalidad: 'electronica' as const,
      estadoCobertura: 'individual_confirmado' as const,
      nivelConfianza:
        asuntoCanonico.calidadTitulo === 'canonico'
          ? 'alto'
          : asuntoCanonicoBase.calidadTitulo === 'incompleto'
            ? 'medio'
            : 'alto',
      esOficial: true,
      resultado:
        votacionMatcheada.siVoto > votacionMatcheada.noVoto ? 'afirmativa' : 'negativa',
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
  await cargarAfiliacionesHistoricas(db, {
    camara: 'representantes',
    legislaturas: [50],
  })
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
            nombreProyecto: 'Asunto sin título identificable',
            tituloPublico: 'Asunto sin título identificable',
            origenTitulo: 'identificador',
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
          nombreProyecto: 'Asunto sin título identificable',
          tituloPublico: 'Asunto sin título identificable',
          origenTitulo: 'identificador',
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

  resultado.legisladoresReconciliados = reconciliarAfiliacionesPorAlias(db, {
    camara: 'representantes',
    legislaturas: [50],
  })

  sqlite.close()
  return resultado
}
