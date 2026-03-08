import { describe, it, expect, beforeEach } from 'vitest'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { cargarSesion } from '../../src/loader/cargador-sesion.js'
import { partidos, legisladores, legislaturas, sesiones, proyectosLey, votos } from '@como-voto-uy/shared'
import type { DB } from '../../src/db/conexion.js'

describe('cargarSesion', () => {
  let db: DB

  beforeEach(() => {
    const conexion = crearConexionEnMemoria()
    pushearSchema(conexion.sqlite)
    db = conexion.db

    // Insertar datos de referencia
    db.insert(partidos).values({ nombre: 'Frente Amplio', sigla: 'FA', color: '#2A52BE' }).run()
    db.insert(legislaturas).values({ numero: 50, fechaInicio: '2025-02-15' }).run()
    db.insert(legisladores).values({ nombre: 'Legislador Test', partidoId: 1, camara: 'senado' }).run()
  })

  it('inserta una sesión con proyectos y votos', () => {
    const sesionInsertada = cargarSesion(db, {
      legislaturaId: 1,
      camara: 'senado',
      fecha: '2025-03-15',
      numero: 1,
      proyectos: [
        {
          nombre: 'Proyecto de prueba',
          descripcion: 'Un proyecto para testear',
          votos: [
            { legisladorId: 1, voto: 'afirmativo' },
          ],
        },
      ],
    })

    expect(sesionInsertada.id).toBe(1)

    const todasSesiones = db.select().from(sesiones).all()
    expect(todasSesiones).toHaveLength(1)

    const todosProyectos = db.select().from(proyectosLey).all()
    expect(todosProyectos).toHaveLength(1)
    expect(todosProyectos[0].nombre).toBe('Proyecto de prueba')

    const todosVotos = db.select().from(votos).all()
    expect(todosVotos).toHaveLength(1)
    expect(todosVotos[0].voto).toBe('afirmativo')
    expect(todosVotos[0].legisladorId).toBe(1)
  })

  it('inserta múltiples proyectos en una sesión', () => {
    cargarSesion(db, {
      legislaturaId: 1,
      camara: 'senado',
      fecha: '2025-03-16',
      proyectos: [
        { nombre: 'Proyecto A', votos: [{ legisladorId: 1, voto: 'afirmativo' }] },
        { nombre: 'Proyecto B', votos: [{ legisladorId: 1, voto: 'negativo' }] },
      ],
    })

    const todosProyectos = db.select().from(proyectosLey).all()
    expect(todosProyectos).toHaveLength(2)

    const todosVotos = db.select().from(votos).all()
    expect(todosVotos).toHaveLength(2)
  })
})
