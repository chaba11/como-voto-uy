import { and, eq, ne } from 'drizzle-orm'
import { legisladores, legislaturas, partidos } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'
import { buscarLegislador } from '../parser/normalizador-nombres.js'
import type { VotacionRepresentantes } from '../scraper/votaciones-representantes.js'
import type { LegisladorPadronRepresentantes } from '../scraper/votaciones-representantes.js'

const PARTIDO_POR_DIPUTADO: Record<string, string> = {
  'Abdala, Pablo D.': 'FA',
  'Bottino, Valentina': 'FA',
  'Gandini, Jorge A.': 'PN',
  'Malan, Juan Martín': 'PN',
}

function obtenerLegislatura50Id(db: DB): number {
  const legislatura = db
    .select({ id: legislaturas.id })
    .from(legislaturas)
    .where(eq(legislaturas.numero, 50))
    .get()

  if (!legislatura) {
    throw new Error('Legislatura 50 no encontrada para seed de representantes')
  }

  return legislatura.id
}

function obtenerPartidoId(db: DB, sigla: string): number | null {
  return (
    db
      .select({ id: partidos.id })
      .from(partidos)
      .where(eq(partidos.sigla, sigla))
      .get()?.id ?? null
  )
}

function obtenerPartidoSinAsignarId(db: DB): number {
  const existente = obtenerPartidoId(db, 'SA')
  if (existente) return existente

  return db
    .insert(partidos)
    .values({ nombre: 'Sin asignar', sigla: 'SA', color: '#999999' })
    .returning({ id: partidos.id })
    .get().id
}

function resolverSiglaPartido(
  nombre: string,
  padron: LegisladorPadronRepresentantes[],
): { sigla: string | null; origen: 'padron' | 'sin_asignar' } {
  const exacto = padron.find((legislador) => legislador.nombre === nombre)
  if (exacto) {
    return { sigla: exacto.siglaPartido, origen: 'padron' }
  }

  const idMatch = buscarLegislador(
    nombre,
    padron.map((legislador, indice) => ({ id: indice + 1, nombre: legislador.nombre })),
  )

  if (idMatch !== null) {
    return { sigla: padron[idMatch - 1].siglaPartido, origen: 'padron' }
  }

  const manual = PARTIDO_POR_DIPUTADO[nombre]
  if (manual) {
    return { sigla: manual, origen: 'padron' }
  }

  return { sigla: null, origen: 'sin_asignar' }
}

export function extraerLegisladoresUnicos(votaciones: VotacionRepresentantes[]): string[] {
  const nombres = new Set<string>()
  for (const votacion of votaciones) {
    for (const nombre of votacion.Lista_Si) nombres.add(nombre.trim())
    for (const nombre of votacion.Lista_No) nombres.add(nombre.trim())
  }
  return [...nombres].sort()
}

export async function seedLegisladoresRepresentantes(
  db: DB,
  votaciones: VotacionRepresentantes[],
  padron: LegisladorPadronRepresentantes[] = [],
): Promise<number> {
  const nombres = extraerLegisladoresUnicos(votaciones)
  const legislaturaId = obtenerLegislatura50Id(db)
  let insertados = 0
  let sinAsignar = 0

  for (const nombre of nombres) {
    const existente = db
      .select()
      .from(legisladores)
      .where(
        and(
          eq(legisladores.nombre, nombre),
          eq(legisladores.legislaturaId, legislaturaId),
          eq(legisladores.camara, 'representantes'),
        ),
      )
      .get()

    if (existente) continue

    const partidoResuelto = resolverSiglaPartido(nombre, padron)
    const partidoId = partidoResuelto.sigla
      ? (obtenerPartidoId(db, partidoResuelto.sigla) ?? obtenerPartidoSinAsignarId(db))
      : obtenerPartidoSinAsignarId(db)

    if (!partidoResuelto.sigla) {
      sinAsignar++
    }

    db.insert(legisladores)
      .values({
        nombre,
        legislaturaId,
        partidoId,
        camara: 'representantes',
        origenPartido: partidoResuelto.sigla ? 'padron' : 'sin_asignar',
      })
      .run()
    insertados++
  }

  if (sinAsignar > 0) {
    console.warn(
      `Legisladores representantes sin partido resuelto automáticamente: ${sinAsignar}`,
    )
  }

  return insertados
}

export function reconciliarLegisladoresSinAsignar(db: DB, legislaturaId: number) {
  const partidoSaId = obtenerPartidoSinAsignarId(db)
  const candidatos = db
    .select({
      id: legisladores.id,
      nombre: legisladores.nombre,
      camara: legisladores.camara,
    })
    .from(legisladores)
    .where(
      and(
        eq(legisladores.legislaturaId, legislaturaId),
        eq(legisladores.partidoId, partidoSaId),
      ),
    )
    .all()

  let reconciliados = 0
  for (const candidato of candidatos) {
    const universo = db
      .select({
        id: legisladores.id,
        nombre: legisladores.nombre,
      })
      .from(legisladores)
      .where(
        and(
          eq(legisladores.legislaturaId, legislaturaId),
          eq(legisladores.camara, candidato.camara),
          ne(legisladores.partidoId, partidoSaId),
        ),
      )
      .all()

    const legisladorId = buscarLegislador(candidato.nombre, universo)
    if (legisladorId === null) continue

    const destino = db
      .select({ partidoId: legisladores.partidoId })
      .from(legisladores)
      .where(eq(legisladores.id, legisladorId))
      .get()

    if (!destino) continue

    db.update(legisladores)
      .set({
        partidoId: destino.partidoId,
        origenPartido: 'inferido',
      })
      .where(eq(legisladores.id, candidato.id))
      .run()
    reconciliados++
  }

  return reconciliados
}

export { PARTIDO_POR_DIPUTADO }
