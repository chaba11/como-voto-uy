import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  partidos,
  legisladores,
  legislaturas,
  fuentes,
  sesiones,
  asuntos,
  votaciones,
  resultadosAgregados,
  votosIndividuales,
  evidencias,
  LEGISLATURAS,
  MIEMBROS_POR_CAMARA,
  MIEMBROS_POR_CUERPO,
} from '@como-voto-uy/shared'

describe('schema', () => {
  it('exporta todas las tablas', () => {
    expect(partidos).toBeDefined()
    expect(legisladores).toBeDefined()
    expect(legislaturas).toBeDefined()
    expect(fuentes).toBeDefined()
    expect(sesiones).toBeDefined()
    expect(asuntos).toBeDefined()
    expect(votaciones).toBeDefined()
    expect(resultadosAgregados).toBeDefined()
    expect(votosIndividuales).toBeDefined()
    expect(evidencias).toBeDefined()
  })

  it('tablas tienen nombres correctos', () => {
    expect(getTableName(partidos)).toBe('partidos')
    expect(getTableName(legisladores)).toBe('legisladores')
    expect(getTableName(legislaturas)).toBe('legislaturas')
    expect(getTableName(fuentes)).toBe('fuentes')
    expect(getTableName(sesiones)).toBe('sesiones')
    expect(getTableName(asuntos)).toBe('asuntos')
    expect(getTableName(votaciones)).toBe('votaciones')
    expect(getTableName(resultadosAgregados)).toBe('resultados_agregados')
    expect(getTableName(votosIndividuales)).toBe('votos_individuales')
    expect(getTableName(evidencias)).toBe('evidencias')
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

  it('tiene miembros por cuerpo correctos', () => {
    expect(MIEMBROS_POR_CUERPO.asamblea_general).toBe(130)
    expect(MIEMBROS_POR_CUERPO.comision_permanente).toBe(16)
  })
})
