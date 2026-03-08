import { eq, and } from 'drizzle-orm'
import { sesiones, legisladores } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'
import type { Camara } from '@como-voto-uy/shared'

export function sesionExiste(
  db: DB,
  camara: Camara,
  fecha: string,
  numero?: number
): boolean {
  const condiciones = [
    eq(sesiones.camara, camara),
    eq(sesiones.fecha, fecha),
  ]

  if (numero !== undefined) {
    condiciones.push(eq(sesiones.numero, numero))
  }

  const resultado = db
    .select()
    .from(sesiones)
    .where(and(...condiciones))
    .get()

  return resultado !== undefined
}

export function legisladorExiste(
  db: DB,
  nombre: string,
  camara: Camara
): number | null {
  const resultado = db
    .select({ id: legisladores.id })
    .from(legisladores)
    .where(
      and(
        eq(legisladores.nombre, nombre),
        eq(legisladores.camara, camara)
      )
    )
    .get()

  return resultado?.id ?? null
}
