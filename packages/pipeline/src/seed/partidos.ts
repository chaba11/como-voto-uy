import { eq } from 'drizzle-orm'
import { partidos } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'

const PARTIDOS = [
  { nombre: 'Frente Amplio', sigla: 'FA', color: '#2A52BE' },
  { nombre: 'Partido Nacional', sigla: 'PN', color: '#0072CE' },
  { nombre: 'Partido Colorado', sigla: 'PC', color: '#E31937' },
  { nombre: 'Cabildo Abierto', sigla: 'CA', color: '#6B3FA0' },
  { nombre: 'Partido Independiente', sigla: 'PI', color: '#FFD700' },
  { nombre: 'Partido Ecologista Radical Intransigente', sigla: 'PERI', color: '#228B22' },
  { nombre: 'Unidad Popular', sigla: 'UP', color: '#CC0000' },
  { nombre: 'Sin asignar', sigla: 'SA', color: '#999999' },
] as const

export function seedPartidos(db: DB) {
  for (const partido of PARTIDOS) {
    const existente = db
      .select()
      .from(partidos)
      .where(eq(partidos.sigla, partido.sigla))
      .get()

    if (!existente) {
      db.insert(partidos).values(partido).run()
    }
  }
  console.log(`Partidos insertados: ${PARTIDOS.length}`)
}

export { PARTIDOS }
