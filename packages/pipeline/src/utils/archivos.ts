import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function asegurarDirectorio(ruta: string): Promise<void> {
  await mkdir(ruta, { recursive: true })
}

export async function guardarArchivo(ruta: string, contenido: string): Promise<void> {
  await asegurarDirectorio(dirname(ruta))
  await writeFile(ruta, contenido, 'utf-8')
}

export async function leerArchivo(ruta: string): Promise<string> {
  return readFile(ruta, 'utf-8')
}
