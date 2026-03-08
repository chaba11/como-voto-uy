/**
 * Extrae listas de asistentes y ausentes del texto de una taquigráfica.
 *
 * Busca patrones como:
 * ASISTEN: los señores senadores Apellido1, Apellido2, ...
 * FALTAN: con licencia, los señores senadores Apellido1, Apellido2, ...
 */
export function extraerAsistencia(texto: string): {
  asistentes: string[]
  ausentes: string[]
} {
  const asistentes = extraerListaNombres(texto, 'ASISTEN')
  const ausentes = extraerListaNombres(texto, 'FALTAN')

  return { asistentes, ausentes }
}

function extraerListaNombres(texto: string, marcador: string): string[] {
  // Buscar la sección que empieza con el marcador
  const patronSeccion = new RegExp(
    `${marcador}:\\s*(.+?)(?=FALTAN:|ASISTEN:|$)`,
    'is'
  )

  const match = patronSeccion.exec(texto)
  if (!match) return []

  const seccionTexto = match[1]

  // Extraer nombres en negrita (patrón HTML ya limpio)
  // En texto plano, los nombres suelen estar separados por comas
  // "los señores senadores Apellido1, Apellido2, Apellido3 y Apellido4"
  const nombres: string[] = []

  // Limpiar el texto de prefijos comunes
  const textoLimpio = seccionTexto
    .replace(/(?:con\s+licencia|con\s+aviso|por\s+encontrarse[^,;.]+)[,;.]?\s*/gi, '')
    .replace(/los?\s+señor(?:es|a|as)?\s+senad(?:or(?:es|a|as)?)\s*/gi, '')
    .replace(/(?:la|el)\s+señor[a]?\s*/gi, '')
    .replace(/Se\s+retiran[^.]+\./gi, '')
    .trim()

  // Separar por comas y "y"
  const partes = textoLimpio
    .split(/[,;]\s*|\s+y\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  for (const parte of partes) {
    // Extraer solo el nombre (puede haber texto adicional después)
    const nombre = parte
      .replace(/[.,;]+$/, '')
      .trim()

    if (nombre.length > 1 && /^[A-ZÁÉÍÓÚÑ]/.test(nombre)) {
      nombres.push(nombre.toUpperCase())
    }
  }

  return nombres
}
