import { eq, and } from 'drizzle-orm'
import { legisladores } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'
import type { Camara } from '@como-voto-uy/shared'

export interface DatosLegislador {
  nombre: string
  partidoId: number
  camara: Camara
  departamento?: string
  /** Nombre del titular, para vincular suplentes */
  nombreTitular?: string
}

export function cargarLegisladores(db: DB, datos: DatosLegislador[]) {
  return db.transaction((tx) => {
    const insertados: { id: number; nombre: string }[] = []

    // Primero insertar/actualizar titulares (los que no tienen nombreTitular)
    const titulares = datos.filter((d) => !d.nombreTitular)
    const suplentes = datos.filter((d) => d.nombreTitular)

    for (const titular of titulares) {
      const existente = tx
        .select()
        .from(legisladores)
        .where(
          and(
            eq(legisladores.nombre, titular.nombre),
            eq(legisladores.camara, titular.camara)
          )
        )
        .get()

      if (existente) {
        tx.update(legisladores)
          .set({
            partidoId: titular.partidoId,
            departamento: titular.departamento,
          })
          .where(eq(legisladores.id, existente.id))
          .run()
        insertados.push({ id: existente.id, nombre: titular.nombre })
      } else {
        const nuevo = tx
          .insert(legisladores)
          .values({
            nombre: titular.nombre,
            partidoId: titular.partidoId,
            camara: titular.camara,
            departamento: titular.departamento,
          })
          .returning()
          .get()
        insertados.push({ id: nuevo.id, nombre: titular.nombre })
      }
    }

    // Luego insertar/actualizar suplentes con titular_id
    for (const suplente of suplentes) {
      const titular = insertados.find((i) => i.nombre === suplente.nombreTitular)
      const titularId = titular?.id ?? null

      const existente = tx
        .select()
        .from(legisladores)
        .where(
          and(
            eq(legisladores.nombre, suplente.nombre),
            eq(legisladores.camara, suplente.camara)
          )
        )
        .get()

      if (existente) {
        tx.update(legisladores)
          .set({
            partidoId: suplente.partidoId,
            departamento: suplente.departamento,
            titularId,
          })
          .where(eq(legisladores.id, existente.id))
          .run()
        insertados.push({ id: existente.id, nombre: suplente.nombre })
      } else {
        const nuevo = tx
          .insert(legisladores)
          .values({
            nombre: suplente.nombre,
            partidoId: suplente.partidoId,
            camara: suplente.camara,
            departamento: suplente.departamento,
            titularId,
          })
          .returning()
          .get()
        insertados.push({ id: nuevo.id, nombre: suplente.nombre })
      }
    }

    return insertados
  })
}
