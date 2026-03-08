import { describe, it, expect } from 'vitest'
import { extraerProyecto } from '../../src/parser/extractor-proyecto.js'

describe('extraerProyecto', () => {
  it('extrae número de carpeta con n.°', () => {
    const proyecto = extraerProyecto('la carpeta n.° 1181/2023')
    expect(proyecto.carpeta).toBe('1181')
  })

  it('extrae número de carpeta con n.º', () => {
    const proyecto = extraerProyecto('(Carpeta n.º 1398/2024)')
    expect(proyecto.carpeta).toBe('1398')
  })

  it('extrae número de carpeta abreviado', () => {
    const proyecto = extraerProyecto('Carp. n.° 1159/2023')
    expect(proyecto.carpeta).toBe('1159')
  })

  it('extrae número de repartido con rep.', () => {
    const proyecto = extraerProyecto('rep. n.° 859/2023')
    expect(proyecto.repartido).toBe('859')
  })

  it('extrae número de repartido completo', () => {
    const proyecto = extraerProyecto('Repartido n.° 860/2023')
    expect(proyecto.repartido).toBe('860')
  })

  it('extrae carpeta y repartido juntos', () => {
    const proyecto = extraerProyecto('Carp. n.° 1159/2023 - rep. n.° 859/2023')
    expect(proyecto.carpeta).toBe('1159')
    expect(proyecto.repartido).toBe('859')
  })

  it('extrae nombre de proyecto de ley', () => {
    const proyecto = extraerProyecto(
      'proyecto de ley por el que se regula el uso de la pirotecnia.'
    )
    expect(proyecto.nombre).toContain('proyecto de ley')
    expect(proyecto.nombre).toContain('pirotecnia')
  })

  it('extrae nombre de proyecto de minuta de comunicación', () => {
    const proyecto = extraerProyecto(
      'proyecto de minuta de comunicación por el que se solicita al Poder Ejecutivo algo.'
    )
    expect(proyecto.nombre).toContain('proyecto de minuta de comunicación')
  })

  it('retorna objeto vacío si no hay información', () => {
    const proyecto = extraerProyecto('Texto sin información de proyecto.')
    expect(proyecto.carpeta).toBeUndefined()
    expect(proyecto.repartido).toBeUndefined()
    expect(proyecto.nombre).toBeUndefined()
  })
})
