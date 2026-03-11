import { and, eq } from 'drizzle-orm'
import {
  aliasLegisladores,
  legisladores,
  legislaturas,
  partidos,
  resolucionesAfiliacion,
} from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'

interface DatoLegislador {
  nombre: string
  siglaPartido: string
  camara: 'senado' | 'representantes'
}

// Senadores legislatura 50 (2025-2030)
const SENADORES_LEG50: DatoLegislador[] = [
  // Frente Amplio (16)
  { nombre: 'Andrade, Oscar', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Antonini, Eduardo', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Borbonet, Daniel', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Brenta Badano, Eduardo Alfonso', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Caggiani, Daniel', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Carballo Da Costa, Felipe', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Cosse, Carolina', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Díaz, Bettiana', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Ferreira Rodríguez, Zulimar', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'González, Gustavo', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Kechichián, Liliam', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Kramer, Patricia', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Moreira, Constanza', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Pereyra, Aníbal', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Rodríguez González, Blanca', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Sabini, Sebastián', siglaPartido: 'FA', camara: 'senado' },
  { nombre: 'Viera, Nicolás', siglaPartido: 'FA', camara: 'senado' },
  // Partido Nacional (9)
  { nombre: 'Bianchi, Graciela', siglaPartido: 'PN', camara: 'senado' },
  { nombre: 'Blás, Rodrigo', siglaPartido: 'PN', camara: 'senado' },
  { nombre: 'Botana, Sergio', siglaPartido: 'PN', camara: 'senado' },
  { nombre: 'Camy Antognazza, Carlos', siglaPartido: 'PN', camara: 'senado' },
  { nombre: 'Da Silva, Sebastián', siglaPartido: 'PN', camara: 'senado' },
  { nombre: 'Falero, José Luis', siglaPartido: 'PN', camara: 'senado' },
  { nombre: 'García, Javier', siglaPartido: 'PN', camara: 'senado' },
  { nombre: 'Lema, Martín', siglaPartido: 'PN', camara: 'senado' },
  { nombre: 'Moreira, Carlos', siglaPartido: 'PN', camara: 'senado' },
  // Partido Colorado (5)
  { nombre: 'Bordaberry Herrán, Juan Pedro', siglaPartido: 'PC', camara: 'senado' },
  { nombre: 'Ojeda, Andrés', siglaPartido: 'PC', camara: 'senado' },
  { nombre: 'Silva, Robert', siglaPartido: 'PC', camara: 'senado' },
  { nombre: 'Viera Duarte, Tabaré', siglaPartido: 'PC', camara: 'senado' },
  { nombre: 'Zubía, Gustavo', siglaPartido: 'PC', camara: 'senado' },
]

export function seedLegisladores(db: DB) {
  let insertados = 0
  const legislatura50 = db
    .select({ id: legislaturas.id })
    .from(legislaturas)
    .where(eq(legislaturas.numero, 50))
    .get()

  if (!legislatura50) {
    throw new Error('Legislatura 50 no encontrada para seed de senadores')
  }

  for (const dato of SENADORES_LEG50) {
    // Buscar el partido por sigla
    const partido = db
      .select()
      .from(partidos)
      .where(eq(partidos.sigla, dato.siglaPartido))
      .get()

    if (!partido) {
      console.warn(`Partido ${dato.siglaPartido} no encontrado, omitiendo ${dato.nombre}`)
      continue
    }

    // Verificar si ya existe
    const existente = db
      .select()
      .from(legisladores)
      .where(
        and(
          eq(legisladores.nombre, dato.nombre),
          eq(legisladores.legislaturaId, legislatura50.id),
          eq(legisladores.camara, dato.camara),
        ),
      )
      .get()

    if (!existente) {
      const insertado = db
        .insert(legisladores)
        .values({
          nombre: dato.nombre,
          legislaturaId: legislatura50.id,
          partidoId: partido.id,
          camara: dato.camara,
          origenPartido: 'seed',
        })
        .returning({ id: legisladores.id })
        .get()

      db.insert(aliasLegisladores)
        .values({
          legisladorId: insertado.id,
          alias: dato.nombre,
          nivelConfianza: 'confirmado',
        })
        .run()

      db.insert(resolucionesAfiliacion)
        .values({
          legisladorId: insertado.id,
          partidoId: partido.id,
          metodo: 'dataset',
          nivelConfianza: 'confirmado',
        })
        .run()
      insertados++
    }
  }

  console.log(`Legisladores insertados: ${insertados}`)
}
