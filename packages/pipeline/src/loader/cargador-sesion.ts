import { and, eq, isNull } from 'drizzle-orm'
import {
  asuntos,
  evidencias,
  fuentes,
  resultadosAgregados,
  sesiones,
  votaciones,
  votosIndividuales,
} from '@como-voto-uy/shared'
import type {
  CalidadTituloAsunto,
  CuerpoLegislativo,
  EstadoCoberturaVotacion,
  ModalidadVotacion,
  NivelConfianzaVoto,
  ResultadoVotacion,
  TipoEvidencia,
  TipoFuente,
  TipoVoto,
} from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'

export interface DatosFuente {
  tipo: TipoFuente
  url: string
  fechaCaptura?: string
  hashContenido?: string
}

export interface DatosEvidencia {
  tipo: TipoEvidencia
  texto?: string
  timestampInicio?: number
  timestampFin?: number
  detalle?: string
}

export interface DatosAsunto {
  nombre: string
  calidadTitulo?: CalidadTituloAsunto
  descripcion?: string
  tema?: string
  codigoOficial?: string
  carpeta?: string
  repartido?: string
  numeroLey?: string
  tipoAsunto?: string
}

export interface DatosVotoIndividual {
  legisladorId: number
  voto: TipoVoto
  nivelConfianza?: NivelConfianzaVoto
  esOficial?: boolean
  fuente?: DatosFuente
  evidencias?: DatosEvidencia[]
}

export interface DatosResultadoAgregado {
  afirmativos?: number
  negativos?: number
  abstenciones?: number
  totalPresentes?: number
  totalMiembros?: number
  unanimidad?: boolean
  resultado?: ResultadoVotacion
}

export interface DatosVotacion {
  asunto?: DatosAsunto | null
  ordenSesion?: number
  modalidad: ModalidadVotacion
  estadoCobertura: EstadoCoberturaVotacion
  nivelConfianza: NivelConfianzaVoto
  esOficial?: boolean
  resultado?: ResultadoVotacion
  fuentePrincipal?: DatosFuente
  votosIndividuales?: DatosVotoIndividual[]
  resultadoAgregado?: DatosResultadoAgregado
  evidencias?: DatosEvidencia[]
}

export interface DatosSesion {
  legislaturaId: number
  cuerpo: CuerpoLegislativo
  fecha: string
  numero?: number
  urlTaquigrafica?: string
  fuente?: DatosFuente
  votaciones: DatosVotacion[]
}

function ahoraIso(): string {
  return new Date().toISOString()
}

function crearClaveAsunto(asunto: DatosAsunto): string | null {
  if (asunto.codigoOficial?.trim()) return `codigo:${asunto.codigoOficial.trim()}`
  if (asunto.carpeta?.trim() && asunto.repartido?.trim()) {
    return `carpeta:${asunto.carpeta.trim()}|repartido:${asunto.repartido.trim()}`
  }
  if (asunto.carpeta?.trim()) return `carpeta:${asunto.carpeta.trim()}`
  return null
}

function puntajeCalidadTitulo(calidad?: CalidadTituloAsunto): number {
  switch (calidad) {
    case 'canonico':
      return 3
    case 'razonable':
      return 2
    case 'incompleto':
    default:
      return 1
  }
}

function insertarORecuperarFuente(tx: DB, fuente?: DatosFuente | null): number | null {
  if (!fuente?.url) return null

  const existente = tx
    .select({ id: fuentes.id })
    .from(fuentes)
    .where(and(eq(fuentes.tipo, fuente.tipo), eq(fuentes.url, fuente.url)))
    .get()

  if (existente) return existente.id

  const insertada = tx
    .insert(fuentes)
    .values({
      tipo: fuente.tipo,
      url: fuente.url,
      fechaCaptura: fuente.fechaCaptura ?? ahoraIso(),
      hashContenido: fuente.hashContenido,
    })
    .returning({ id: fuentes.id })
    .get()

  return insertada.id
}

function insertarORecuperarAsunto(tx: DB, asunto?: DatosAsunto | null): number | null {
  if (!asunto) return null

  const clave = crearClaveAsunto(asunto)
  let existente:
    | {
        id: number
      }
    | undefined

  if (clave?.startsWith('codigo:')) {
    existente = tx
      .select({ id: asuntos.id })
      .from(asuntos)
      .where(eq(asuntos.codigoOficial, asunto.codigoOficial!))
      .get()
  } else if (clave?.startsWith('carpeta:') && asunto.repartido) {
    existente = tx
      .select({ id: asuntos.id })
      .from(asuntos)
      .where(
        and(
          eq(asuntos.carpeta, asunto.carpeta!),
          eq(asuntos.repartido, asunto.repartido),
        ),
      )
      .get()
  } else if (asunto.carpeta) {
    existente = tx
      .select({ id: asuntos.id })
      .from(asuntos)
      .where(and(eq(asuntos.carpeta, asunto.carpeta), isNull(asuntos.repartido)))
      .get()
  } else {
    existente = tx
      .select({ id: asuntos.id })
      .from(asuntos)
      .where(eq(asuntos.nombre, asunto.nombre))
      .get()
  }

  if (existente) {
    const asuntoActual = tx.select().from(asuntos).where(eq(asuntos.id, existente.id)).get()
    if (asuntoActual) {
      const calidadNueva = asunto.calidadTitulo ?? 'incompleto'
      const calidadActual = asuntoActual.calidadTitulo ?? 'incompleto'
      const actualizaciones: Partial<typeof asuntos.$inferInsert> = {}

      if (puntajeCalidadTitulo(calidadNueva) > puntajeCalidadTitulo(calidadActual)) {
        actualizaciones.nombre = asunto.nombre
        actualizaciones.calidadTitulo = calidadNueva
      }

      if (!asuntoActual.descripcion && asunto.descripcion) {
        actualizaciones.descripcion = asunto.descripcion
      }
      if (!asuntoActual.tema && asunto.tema) {
        actualizaciones.tema = asunto.tema
      }
      if (!asuntoActual.numeroLey && asunto.numeroLey) {
        actualizaciones.numeroLey = asunto.numeroLey
      }
      if (!asuntoActual.tipoAsunto && asunto.tipoAsunto) {
        actualizaciones.tipoAsunto = asunto.tipoAsunto
      }

      if (Object.keys(actualizaciones).length > 0) {
        tx.update(asuntos).set(actualizaciones).where(eq(asuntos.id, existente.id)).run()
      }
    }

    return existente.id
  }

  const insertado = tx
    .insert(asuntos)
    .values({
      nombre: asunto.nombre,
      calidadTitulo: asunto.calidadTitulo ?? 'incompleto',
      descripcion: asunto.descripcion,
      tema: asunto.tema,
      codigoOficial: asunto.codigoOficial,
      carpeta: asunto.carpeta,
      repartido: asunto.repartido,
      numeroLey: asunto.numeroLey,
      tipoAsunto: asunto.tipoAsunto,
    })
    .returning({ id: asuntos.id })
    .get()

  return insertado.id
}

export function cargarSesion(db: DB, datos: DatosSesion) {
  return db.transaction((tx) => {
    const fuenteSesionId = insertarORecuperarFuente(tx, datos.fuente)

    const sesionInsertada = tx
      .insert(sesiones)
      .values({
        legislaturaId: datos.legislaturaId,
        cuerpo: datos.cuerpo,
        fecha: datos.fecha,
        numero: datos.numero,
        urlTaquigrafica: datos.urlTaquigrafica,
        fuenteId: fuenteSesionId,
      })
      .returning()
      .get()

    for (const votacion of datos.votaciones) {
      const asuntoId = insertarORecuperarAsunto(tx, votacion.asunto)
      const fuentePrincipalId = insertarORecuperarFuente(tx, votacion.fuentePrincipal)

      const votacionInsertada = tx
        .insert(votaciones)
        .values({
          sesionId: sesionInsertada.id,
          asuntoId,
          ordenSesion: votacion.ordenSesion,
          modalidad: votacion.modalidad,
          estadoCobertura: votacion.estadoCobertura,
          nivelConfianza: votacion.nivelConfianza,
          esOficial: votacion.esOficial ?? true,
          resultado: votacion.resultado,
          fuentePrincipalId,
        })
        .returning({ id: votaciones.id })
        .get()

      if (votacion.resultadoAgregado) {
        tx.insert(resultadosAgregados)
          .values({
            votacionId: votacionInsertada.id,
            afirmativos: votacion.resultadoAgregado.afirmativos,
            negativos: votacion.resultadoAgregado.negativos,
            abstenciones: votacion.resultadoAgregado.abstenciones,
            totalPresentes: votacion.resultadoAgregado.totalPresentes,
            totalMiembros: votacion.resultadoAgregado.totalMiembros,
            unanimidad: votacion.resultadoAgregado.unanimidad,
            resultado: votacion.resultadoAgregado.resultado,
          })
          .run()
      }

      for (const votoIndividual of votacion.votosIndividuales ?? []) {
        const fuenteVotoId = insertarORecuperarFuente(tx, votoIndividual.fuente)
        const votoInsertado = tx
          .insert(votosIndividuales)
          .values({
            votacionId: votacionInsertada.id,
            legisladorId: votoIndividual.legisladorId,
            voto: votoIndividual.voto,
            nivelConfianza: votoIndividual.nivelConfianza ?? votacion.nivelConfianza,
            esOficial: votoIndividual.esOficial ?? votacion.esOficial ?? true,
            fuenteId: fuenteVotoId,
          })
          .returning({ id: votosIndividuales.id })
          .get()

        for (const evidencia of votoIndividual.evidencias ?? []) {
          tx.insert(evidencias)
            .values({
              fuenteId: fuenteVotoId ?? fuentePrincipalId ?? fuenteSesionId!,
              votacionId: votacionInsertada.id,
              votoIndividualId: votoInsertado.id,
              tipo: evidencia.tipo,
              texto: evidencia.texto,
              timestampInicio: evidencia.timestampInicio,
              timestampFin: evidencia.timestampFin,
              detalle: evidencia.detalle,
            })
            .run()
        }
      }

      for (const evidencia of votacion.evidencias ?? []) {
        const fuenteEvidenciaId = fuentePrincipalId ?? fuenteSesionId
        if (!fuenteEvidenciaId) continue
        tx.insert(evidencias)
          .values({
            fuenteId: fuenteEvidenciaId,
            votacionId: votacionInsertada.id,
            tipo: evidencia.tipo,
            texto: evidencia.texto,
            timestampInicio: evidencia.timestampInicio,
            timestampFin: evidencia.timestampFin,
            detalle: evidencia.detalle,
          })
          .run()
      }
    }

    return sesionInsertada
  })
}
