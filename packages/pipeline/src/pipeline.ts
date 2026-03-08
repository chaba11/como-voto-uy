import { eq, and } from 'drizzle-orm'
import {
  sesiones,
  legisladores,
  legislaturas,
  MIEMBROS_POR_CAMARA,
} from '@como-voto-uy/shared'
import type { Camara } from '@como-voto-uy/shared'
import { crearConexion } from './db/conexion.js'
import { pushearSchema } from './db/migraciones.js'
import { seedPartidos } from './seed/partidos.js'
import { seedLegislaturas } from './seed/legislaturas.js'
import { seedLegisladores } from './seed/legisladores.js'
import { obtenerListadoSesiones } from './scraper/listado.js'
import { descargarDocumento } from './scraper/descargador.js'
import { parsearTaquigrafica } from './parser/index.js'
import { buscarLegislador } from './parser/normalizador-nombres.js'
import { cargarSesion } from './loader/cargador-sesion.js'
import type { DatosSesion, DatosProyecto } from './loader/cargador-sesion.js'
import type { DB } from './db/conexion.js'
import type { VotacionExtraida } from './parser/tipos-parser.js'

/**
 * Extrae un nombre legible del texto de contexto de una votación.
 */
function limpiarTextoContexto(texto: string): string {
  // Remove line breaks, collapse whitespace
  let limpio = texto.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  // Try to find the most relevant sentence before "(Se vota)"
  const seVotaIdx = limpio.indexOf('Se va a votar')
  if (seVotaIdx === -1) {
    const seVota2 = limpio.indexOf('(Se vota)')
    if (seVota2 > 0) {
      limpio = limpio.slice(0, seVota2).trim()
    }
  } else {
    limpio = limpio.slice(0, seVotaIdx).trim()
  }

  // Take last meaningful sentence (skip attendance/procedural text)
  const oraciones = limpio.split(/[.]\s+/).filter((s) => s.length > 10)
  if (oraciones.length > 0) {
    limpio = oraciones[oraciones.length - 1].trim()
  }

  // Remove leading dashes, numbers
  limpio = limpio.replace(/^[\d\s)–\-]+/, '').trim()

  return limpio.slice(0, 200) || 'Votación sin identificar'
}

export interface OpcionesPipeline {
  camara: Camara
  legislatura: number
  rutaDb: string
  limite?: number // máximo de sesiones a procesar
}

export interface ResultadoPipeline {
  sesionesListadas: number
  sesionesNuevas: number
  sesionesOmitidas: number
  sesionesConError: number
  votacionesExtraidas: number
  errores: string[]
}

/**
 * Verifica si una sesión ya existe en la base de datos.
 */
function sesionExiste(
  db: DB,
  legislaturaId: number,
  camara: Camara,
  numero: number,
): boolean {
  const existente = db
    .select()
    .from(sesiones)
    .where(
      and(
        eq(sesiones.legislaturaId, legislaturaId),
        eq(sesiones.camara, camara),
        eq(sesiones.numero, numero),
      ),
    )
    .get()

  return !!existente
}

/**
 * Obtiene el ID de la legislatura por su número.
 */
function obtenerLegislaturaId(db: DB, numero: number): number {
  const leg = db
    .select()
    .from(legislaturas)
    .where(eq(legislaturas.numero, numero))
    .get()

  if (!leg) {
    throw new Error(`Legislatura ${numero} no encontrada en la base de datos`)
  }

  return leg.id
}

/**
 * Obtiene los legisladores de la cámara para mapear votos.
 */
function obtenerLegisladoresCamara(
  db: DB,
  camara: Camara,
): { id: number; nombre: string }[] {
  return db
    .select({ id: legisladores.id, nombre: legisladores.nombre })
    .from(legisladores)
    .where(eq(legisladores.camara, camara))
    .all()
}

/**
 * Convierte una votación parseada en datos de proyecto para cargar en la DB.
 */
function votacionADatosProyecto(
  votacion: VotacionExtraida,
  listaLegisladores: { id: number; nombre: string }[],
): DatosProyecto | null {
  const nombre =
    votacion.proyecto?.nombre ||
    limpiarTextoContexto(votacion.textoContexto) ||
    'Votación sin identificar'

  const votosDb: DatosProyecto['votos'] = []

  for (const voto of votacion.votos) {
    const legisladorId = buscarLegislador(voto.nombreLegislador, listaLegisladores)
    if (legisladorId !== null) {
      votosDb.push({
        legisladorId,
        voto: voto.voto,
      })
    }
  }

  return {
    nombre,
    descripcion: votacion.proyecto?.carpeta
      ? `Carpeta n.° ${votacion.proyecto.carpeta}`
      : undefined,
    tema: undefined,
    votos: votosDb,
    resultadoAfirmativos: votacion.resultado?.afirmativos,
    resultadoTotal: votacion.resultado?.total,
    resultado: votacion.resultado?.resultado,
    unanimidad: votacion.resultado?.unanimidad,
  }
}

/**
 * Ejecuta el pipeline completo: scraper -> parser -> loader.
 */
export async function ejecutarPipeline(
  opciones: OpcionesPipeline,
): Promise<ResultadoPipeline> {
  const resultado: ResultadoPipeline = {
    sesionesListadas: 0,
    sesionesNuevas: 0,
    sesionesOmitidas: 0,
    sesionesConError: 0,
    votacionesExtraidas: 0,
    errores: [],
  }

  // 1. Crear/abrir DB, pushear schema, seed
  const { db, sqlite } = crearConexion(opciones.rutaDb)
  pushearSchema(sqlite)
  seedPartidos(db)
  seedLegislaturas(db)
  seedLegisladores(db)

  const legislaturaId = obtenerLegislaturaId(db, opciones.legislatura)
  const listaLegisladores = obtenerLegisladoresCamara(db, opciones.camara)

  if (listaLegisladores.length === 0) {
    console.warn(
      `No hay legisladores cargados para ${opciones.camara}. Los votos no se podrán mapear.`,
    )
  }

  // 2. Obtener listado de sesiones del sitio del parlamento
  console.log(
    `Obteniendo listado de sesiones: ${opciones.camara}, legislatura ${opciones.legislatura}...`,
  )
  const entradas = await obtenerListadoSesiones(opciones.camara, opciones.legislatura)
  resultado.sesionesListadas = entradas.length
  console.log(`Sesiones encontradas: ${entradas.length}`)

  // Aplicar límite si corresponde
  const entradasAProcesar = opciones.limite
    ? entradas.slice(0, opciones.limite)
    : entradas

  // 3. Procesar cada sesión
  for (const entrada of entradasAProcesar) {
    // Verificar si ya existe
    if (sesionExiste(db, legislaturaId, opciones.camara, entrada.sesionNumero)) {
      console.log(`  Sesión ${entrada.sesionNumero} ya existe, omitiendo.`)
      resultado.sesionesOmitidas++
      continue
    }

    try {
      console.log(
        `  Procesando sesión ${entrada.sesionNumero} (${entrada.fecha})...`,
      )

      // a. Descargar documento
      const documento = await descargarDocumento(entrada)

      // b. Parsear votos
      const parseo = parsearTaquigrafica(documento.contenido)
      console.log(
        `    Votaciones encontradas: ${parseo.votaciones.length}`,
      )

      // c. Convertir votaciones a datos de sesión
      const proyectos: DatosProyecto[] = []
      for (const votacion of parseo.votaciones) {
        const datosProyecto = votacionADatosProyecto(votacion, listaLegisladores)
        if (datosProyecto) {
          proyectos.push(datosProyecto)
        }
      }

      const datosSesion: DatosSesion = {
        legislaturaId,
        camara: opciones.camara,
        fecha: entrada.fecha,
        numero: entrada.sesionNumero,
        urlTaquigrafica: entrada.urlDocumentoPagina,
        proyectos,
      }

      // d. Cargar a DB
      cargarSesion(db, datosSesion)

      resultado.sesionesNuevas++
      resultado.votacionesExtraidas += parseo.votaciones.length

      console.log(
        `    Cargada sesión ${entrada.sesionNumero} con ${proyectos.length} proyectos.`,
      )
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : String(error)
      console.error(
        `    Error procesando sesión ${entrada.sesionNumero}: ${mensaje}`,
      )
      resultado.errores.push(
        `Sesión ${entrada.sesionNumero}: ${mensaje}`,
      )
      resultado.sesionesConError++
    }
  }

  // 4. Reportar resultados
  console.log('\n--- Resultado del pipeline ---')
  console.log(`Sesiones listadas: ${resultado.sesionesListadas}`)
  console.log(`Sesiones nuevas cargadas: ${resultado.sesionesNuevas}`)
  console.log(`Sesiones omitidas (ya existían): ${resultado.sesionesOmitidas}`)
  console.log(`Sesiones con error: ${resultado.sesionesConError}`)
  console.log(`Votaciones extraídas: ${resultado.votacionesExtraidas}`)

  if (resultado.errores.length > 0) {
    console.log('\nErrores:')
    for (const err of resultado.errores) {
      console.log(`  - ${err}`)
    }
  }

  sqlite.close()
  return resultado
}

// Re-exportar utilidades para uso en tests y CLI
export { votacionADatosProyecto, obtenerLegisladoresCamara, obtenerLegislaturaId }
