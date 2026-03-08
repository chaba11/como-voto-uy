import { describe, it, expect } from 'vitest'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'
import { seedPartidos, PARTIDOS } from '../../src/seed/partidos.js'
import { seedLegislaturas } from '../../src/seed/legislaturas.js'
import { partidos, legislaturas, LEGISLATURAS } from '@como-voto-uy/shared'

describe('seed', () => {
  describe('seedPartidos', () => {
    it('inserta todos los partidos', () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)

      seedPartidos(db)

      const todos = db.select().from(partidos).all()
      expect(todos).toHaveLength(PARTIDOS.length)

      const siglas = todos.map((p) => p.sigla)
      expect(siglas).toContain('FA')
      expect(siglas).toContain('PN')
      expect(siglas).toContain('PC')
      expect(siglas).toContain('CA')
      expect(siglas).toContain('PI')
      expect(siglas).toContain('PERI')
      expect(siglas).toContain('UP')
    })

    it('no duplica partidos al ejecutar dos veces', () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)

      seedPartidos(db)
      seedPartidos(db)

      const todos = db.select().from(partidos).all()
      expect(todos).toHaveLength(PARTIDOS.length)
    })
  })

  describe('seedLegislaturas', () => {
    it('inserta todas las legislaturas', () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)

      seedLegislaturas(db)

      const todas = db.select().from(legislaturas).all()
      expect(todas).toHaveLength(LEGISLATURAS.length)

      const numeros = todas.map((l) => l.numero)
      for (const leg of LEGISLATURAS) {
        expect(numeros).toContain(leg.numero)
      }
    })

    it('no duplica legislaturas al ejecutar dos veces', () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)

      seedLegislaturas(db)
      seedLegislaturas(db)

      const todas = db.select().from(legislaturas).all()
      expect(todas).toHaveLength(LEGISLATURAS.length)
    })

    it('la legislatura 50 no tiene fecha de fin', () => {
      const { db, sqlite } = crearConexionEnMemoria()
      pushearSchema(sqlite)

      seedLegislaturas(db)

      const leg50 = db.select().from(legislaturas).all().find((l) => l.numero === 50)
      expect(leg50).toBeDefined()
      expect(leg50!.fechaFin).toBeNull()
    })
  })
})
