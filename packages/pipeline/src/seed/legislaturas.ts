import { legislaturas, LEGISLATURAS } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'

export function seedLegislaturas(db: DB) {
  for (const leg of LEGISLATURAS) {
    db.insert(legislaturas)
      .values({
        numero: leg.numero,
        fechaInicio: leg.fechaInicio,
        fechaFin: leg.fechaFin,
      })
      .onConflictDoNothing()
      .run()
  }
  console.log(`Legislaturas insertadas: ${LEGISLATURAS.length}`)
}
