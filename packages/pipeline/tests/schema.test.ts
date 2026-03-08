import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  partidos,
  legisladores,
  legislaturas,
  sesiones,
  proyectosLey,
  votos,
  LEGISLATURAS,
  MIEMBROS_POR_CAMARA,
} from '@como-voto-uy/shared'

describe('schema', () => {
  it('exporta todas las tablas', () => {
    expect(partidos).toBeDefined()
    expect(legisladores).toBeDefined()
    expect(legislaturas).toBeDefined()
    expect(sesiones).toBeDefined()
    expect(proyectosLey).toBeDefined()
    expect(votos).toBeDefined()
  })

  it('tablas tienen nombres correctos', () => {
    expect(getTableName(partidos)).toBe('partidos')
    expect(getTableName(legisladores)).toBe('legisladores')
    expect(getTableName(legislaturas)).toBe('legislaturas')
    expect(getTableName(sesiones)).toBe('sesiones')
    expect(getTableName(proyectosLey)).toBe('proyectos_ley')
    expect(getTableName(votos)).toBe('votos')
  })
})

describe('constantes', () => {
  it('tiene legislaturas 45-50', () => {
    expect(LEGISLATURAS).toHaveLength(6)
    expect(LEGISLATURAS[0].numero).toBe(45)
    expect(LEGISLATURAS[5].numero).toBe(50)
  })

  it('tiene miembros por cámara correctos', () => {
    expect(MIEMBROS_POR_CAMARA.senado).toBe(31)
    expect(MIEMBROS_POR_CAMARA.representantes).toBe(99)
  })
})
