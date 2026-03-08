import { describe, it, expect, beforeEach } from 'vitest'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { sesionExiste, legisladorExiste } from '../../src/loader/deduplicador.js'
import { cargarSesion } from '../../src/loader/cargador-sesion.js'
import { partidos, legisladores, legislaturas } from '@como-voto-uy/shared'
import type { DB } from '../../src/db/conexion.js'

describe('deduplicador', () => {
  let db: DB

  beforeEach(() => {
    const conexion = crearConexionEnMemoria()
    pushearSchema(conexion.sqlite)
    db = conexion.db

    db.insert(partidos).values({ nombre: 'Frente Amplio', sigla: 'FA', color: '#2A52BE' }).run()
    db.insert(legislaturas).values({ numero: 50, fechaInicio: '2025-02-15' }).run()
  })

  describe('sesionExiste', () => {
    it('retorna false si la sesión no existe', () => {
      expect(sesionExiste(db, 'senado', '2025-03-15', 1)).toBe(false)
    })

    it('retorna true si la sesión ya fue cargada', () => {
      cargarSesion(db, {
        legislaturaId: 1,
        camara: 'senado',
        fecha: '2025-03-15',
        numero: 1,
        proyectos: [],
      })

      expect(sesionExiste(db, 'senado', '2025-03-15', 1)).toBe(true)
    })

    it('no confunde sesiones de diferentes cámaras', () => {
      cargarSesion(db, {
        legislaturaId: 1,
        camara: 'senado',
        fecha: '2025-03-15',
        numero: 1,
        proyectos: [],
      })

      expect(sesionExiste(db, 'representantes', '2025-03-15', 1)).toBe(false)
    })
  })

  describe('legisladorExiste', () => {
    it('retorna null si el legislador no existe', () => {
      expect(legisladorExiste(db, 'Nadie', 'senado')).toBeNull()
    })

    it('retorna el id si el legislador existe', () => {
      db.insert(legisladores)
        .values({ nombre: 'Legislador Test', partidoId: 1, camara: 'senado' })
        .run()

      const id = legisladorExiste(db, 'Legislador Test', 'senado')
      expect(id).toBe(1)
    })

    it('no confunde legisladores de diferentes cámaras', () => {
      db.insert(legisladores)
        .values({ nombre: 'Legislador Test', partidoId: 1, camara: 'senado' })
        .run()

      expect(legisladorExiste(db, 'Legislador Test', 'representantes')).toBeNull()
    })
  })
})
