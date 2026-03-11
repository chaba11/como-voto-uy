import { eq, and } from 'drizzle-orm'
import { sesiones, legisladores } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'
import type { Camara, CuerpoLegislativo } from '@como-voto-uy/shared'

export function sesionExiste(
  db: DB,
  cuerpo: CuerpoLegislativo,
  fecha: string,
  numero?: number
): boolean {
  const condiciones = [
    eq(sesiones.cuerpo, cuerpo),
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
  camara: Camara,
  legislaturaId?: number,
): number | null {
  const condiciones = [eq(legisladores.nombre, nombre), eq(legisladores.camara, camara)]
  if (legislaturaId !== undefined) {
    condiciones.push(eq(legisladores.legislaturaId, legislaturaId))
  }

  const resultado = db
    .select({ id: legisladores.id })
    .from(legisladores)
    .where(and(...condiciones))
    .get()

  return resultado?.id ?? null
}
