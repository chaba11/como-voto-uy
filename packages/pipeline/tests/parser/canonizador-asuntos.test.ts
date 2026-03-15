import { describe, expect, it } from 'vitest'
import { extraerDescripcionContextual } from '../../src/parser/canonizador-asuntos.js'

describe('extraerDescripcionContextual', () => {
  it('extrae contenido de texto entrecomillado con «...»', () => {
    const texto =
      'SEÑORA PRESIDENTA.- Léase una moción de orden. «Mocionamos para que se declare urgente el proyecto de ley por el cual se aprueba el Convenio entre Uruguay y España sobre cooperación en defensa, suscrito en Montevideo el 5 de julio de 2023.»'
    const resultado = extraerDescripcionContextual(texto)
    expect(resultado).toContain('proyecto de ley por el cual se aprueba el Convenio')
  })

  it('extrae descripción de lectura del secretario', () => {
    const texto =
      '9) EJÉRCITO DEL AIRE Y DEL ESPACIO DEL REINO DE ESPAÑA. SEÑOR SECRETARIO (Gustavo Sánchez Piñeiro).- El proyecto de ley aprueba el Acuerdo Marco entre el Gobierno de la República Oriental del Uruguay y el Gobierno del Reino de España sobre cooperación en el ámbito de la defensa.'
    const resultado = extraerDescripcionContextual(texto)
    expect(resultado).toContain('proyecto de ley aprueba el Acuerdo Marco')
  })

  it('extrae texto descriptivo general después de encabezado de agenda', () => {
    const texto =
      '5) REGULACIÓN DEL USO DE LA PIROTECNIA. - Proyecto de ley remitido por el Poder Ejecutivo que establece restricciones al uso de pirotecnia en todo el territorio nacional, con el objetivo de proteger a personas con trastornos sensoriales y animales domésticos.'
    const resultado = extraerDescripcionContextual(texto)
    expect(resultado).toContain('Proyecto de ley remitido por el Poder Ejecutivo')
  })

  it('retorna undefined para texto vacío', () => {
    expect(extraerDescripcionContextual('')).toBeUndefined()
    expect(extraerDescripcionContextual('   ')).toBeUndefined()
  })

  it('retorna undefined para texto muy corto', () => {
    expect(extraerDescripcionContextual('Se vota el proyecto.')).toBeUndefined()
  })

  it('elimina firmas del texto', () => {
    const texto =
      'SEÑOR SECRETARIO.- Proyecto de ley que establece la regulación del teletrabajo en el sector público y privado. (Firman los señores senadores Fulano, Mengano y Zutano)'
    const resultado = extraerDescripcionContextual(texto)
    expect(resultado).not.toContain('Firman')
    expect(resultado).toContain('regulación del teletrabajo')
  })

  it('elimina referencias a carpeta y repartido', () => {
    const texto =
      'SEÑOR SECRETARIO.- Proyecto de ley que modifica el Código Penal en materia de delitos informáticos. Carpeta n.º 1234/2024. Repartido n.º 567/2024. Se establece un nuevo marco regulatorio.'
    const resultado = extraerDescripcionContextual(texto)
    expect(resultado).not.toContain('Carpeta')
    expect(resultado).not.toContain('Repartido')
  })

  it('trunca texto largo a ~1000 caracteres', () => {
    const textoLargo = 'SEÑOR SECRETARIO.- ' + 'A'.repeat(1200)
    const resultado = extraerDescripcionContextual(textoLargo)
    expect(resultado).toBeDefined()
    expect(resultado!.length).toBeLessThanOrEqual(1001) // 1000 + "…"
    expect(resultado!.endsWith('…')).toBe(true)
  })

  it('quita ruido parlamentario como (Se lee)', () => {
    const texto =
      'SEÑOR SECRETARIO.- (Se lee) Proyecto de ley por el cual se crea el Registro Nacional de Deudores Alimentarios, con el fin de dar cumplimiento a las obligaciones alimentarias.'
    const resultado = extraerDescripcionContextual(texto)
    expect(resultado).not.toContain('(Se lee)')
    expect(resultado).toContain('Registro Nacional de Deudores Alimentarios')
  })
})
