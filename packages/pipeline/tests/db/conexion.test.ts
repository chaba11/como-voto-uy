import { describe, it, expect } from 'vitest'
import { crearConexionEnMemoria } from '../../src/db/conexion.js'
import { pushearSchema } from '../../src/db/migraciones.js'

describe('conexion', () => {
  it('crea una base de datos en memoria y pushea el schema', () => {
    const { db, sqlite } = crearConexionEnMemoria()
    pushearSchema(sqlite)

    const tablas = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]

    const nombres = tablas.map((t) => t.name)

    expect(nombres).toContain('partidos')
    expect(nombres).toContain('legisladores')
    expect(nombres).toContain('legislaturas')
    expect(nombres).toContain('sesiones')
    expect(nombres).toContain('proyectos_ley')
    expect(nombres).toContain('votos')
  })

  it('tiene foreign keys habilitadas', () => {
    const { sqlite } = crearConexionEnMemoria()

    const resultado = sqlite.pragma('foreign_keys') as { foreign_keys: number }[]
    expect(resultado[0].foreign_keys).toBe(1)
  })
})
