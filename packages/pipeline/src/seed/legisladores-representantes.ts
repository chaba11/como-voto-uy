import { eq, and } from 'drizzle-orm'
import { legisladores, partidos } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'
import type { VotacionRepresentantes } from '../scraper/votaciones-representantes.js'

// Mapeo de diputados a sigla de partido (legislatura 50, 2025-2030)
// Formato: "Apellido, Nombre" -> sigla del partido
// Se puede poblar progresivamente a medida que se obtengan los datos
const PARTIDO_POR_DIPUTADO: Record<string, string> = {
  // Frente Amplio
  'Abdala, Pablo D.': 'FA',
  'Bottino, Valentina': 'FA',
  // Partido Nacional
  'Gandini, Jorge A.': 'PN',
  'Malan, Juan Martín': 'PN',
}

/** Extrae nombres de legisladores unicos de los datos de votaciones */
export function extraerLegisladoresUnicos(votaciones: VotacionRepresentantes[]): string[] {
  const nombres = new Set<string>()
  for (const v of votaciones) {
    for (const nombre of v.Lista_Si) nombres.add(nombre.trim())
    for (const nombre of v.Lista_No) nombres.add(nombre.trim())
  }
  return [...nombres].sort()
}

/**
 * Inserta legisladores representantes en la base de datos.
 * Solo inserta aquellos que tienen un partido asignado en PARTIDO_POR_DIPUTADO.
 * Los legisladores sin mapeo de partido se omiten con un aviso.
 */
export async function seedLegisladoresRepresentantes(
  db: DB,
  votaciones: VotacionRepresentantes[],
): Promise<number> {
  const nombres = extraerLegisladoresUnicos(votaciones)
  let insertados = 0
  let omitidos = 0

  for (const nombre of nombres) {
    // Verificar si ya existe
    const existente = db
      .select()
      .from(legisladores)
      .where(
        and(
          eq(legisladores.nombre, nombre),
          eq(legisladores.camara, 'representantes'),
        ),
      )
      .get()

    if (existente) continue

    // Buscar partido
    const siglaPartido = PARTIDO_POR_DIPUTADO[nombre]
    let partidoId: number | undefined

    if (siglaPartido) {
      const partido = db
        .select()
        .from(partidos)
        .where(eq(partidos.sigla, siglaPartido))
        .get()
      if (partido) partidoId = partido.id
    }

    if (!partidoId) {
      // Usar partido por defecto "Sin asignar"
      let sinAsignar = db
        .select()
        .from(partidos)
        .where(eq(partidos.sigla, 'SA'))
        .get()

      if (!sinAsignar) {
        sinAsignar = db
          .insert(partidos)
          .values({ nombre: 'Sin asignar', sigla: 'SA', color: '#999999' })
          .returning()
          .get()
      }
      partidoId = sinAsignar.id
      omitidos++
    }

    db.insert(legisladores)
      .values({
        nombre,
        partidoId,
        camara: 'representantes',
      })
      .run()
    insertados++
  }

  if (omitidos > 0) {
    console.log(`Legisladores representantes sin partido conocido (asignados a "Sin asignar"): ${omitidos}`)
  }
  console.log(`Legisladores representantes insertados: ${insertados}`)
  return insertados
}

export { PARTIDO_POR_DIPUTADO }
