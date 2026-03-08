import { sesiones, proyectosLey, votos } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'
import type { Camara, TipoVoto } from '@como-voto-uy/shared'

export interface DatosProyecto {
  nombre: string
  descripcion?: string
  tema?: string
  votos: {
    legisladorId: number
    voto: TipoVoto
  }[]
}

export interface DatosSesion {
  legislaturaId: number
  camara: Camara
  fecha: string
  numero?: number
  urlTaquigrafica?: string
  proyectos: DatosProyecto[]
}

export function cargarSesion(db: DB, datos: DatosSesion) {
  return db.transaction((tx) => {
    const sesionInsertada = tx
      .insert(sesiones)
      .values({
        legislaturaId: datos.legislaturaId,
        camara: datos.camara,
        fecha: datos.fecha,
        numero: datos.numero,
        urlTaquigrafica: datos.urlTaquigrafica,
      })
      .returning()
      .get()

    for (const proyecto of datos.proyectos) {
      const proyectoInsertado = tx
        .insert(proyectosLey)
        .values({
          nombre: proyecto.nombre,
          descripcion: proyecto.descripcion,
          tema: proyecto.tema,
          sesionId: sesionInsertada.id,
        })
        .returning()
        .get()

      if (proyecto.votos.length > 0) {
        tx.insert(votos)
          .values(
            proyecto.votos.map((v) => ({
              proyectoLeyId: proyectoInsertado.id,
              legisladorId: v.legisladorId,
              voto: v.voto,
            }))
          )
          .run()
      }
    }

    return sesionInsertada
  })
}
