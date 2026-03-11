import { eq } from 'drizzle-orm'
import { partidos } from '@como-voto-uy/shared'
import type { DB } from '../db/conexion.js'

const PARTIDOS = [
  { nombre: 'Frente Amplio', sigla: 'FA', color: '#2A52BE' },
  { nombre: 'Partido Nacional', sigla: 'PN', color: '#0072CE' },
  { nombre: 'Partido Colorado', sigla: 'PC', color: '#E31937' },
  { nombre: 'Cabildo Abierto', sigla: 'CA', color: '#6B3FA0' },
  { nombre: 'Partido Independiente', sigla: 'PI', color: '#FFD700' },
  { nombre: 'Partido Ecologista Radical Intransigente', sigla: 'PERI', color: '#228B22' },
  { nombre: 'Unidad Popular', sigla: 'UP', color: '#CC0000' },
  { nombre: 'Asamblea Popular', sigla: 'AP', color: '#8B0000' },
  { nombre: 'Nuevo Espacio', sigla: 'NE', color: '#FF8C00' },
  { nombre: 'Partido Demócrata Cristiano', sigla: 'PDC', color: '#3CB371' },
  { nombre: 'Partido Socialista del Uruguay', sigla: 'PS', color: '#C2185B' },
  { nombre: 'Partido de la Gente', sigla: 'PG', color: '#8B4513' },
  { nombre: 'Partido General Fructuoso Rivera', sigla: 'PGFR', color: '#B22222' },
  { nombre: 'Partido Comunista del Uruguay', sigla: 'PCU', color: '#AA0000' },
  { nombre: 'Unión Cívica del Uruguay', sigla: 'UC', color: '#4B0082' },
  { nombre: 'Unión Popular', sigla: 'UPP', color: '#A52A2A' },
  { nombre: 'Identidad Soberana', sigla: 'IS', color: '#556B2F' },
  { nombre: 'Fidel', sigla: 'FIDEL', color: '#696969' },
  { nombre: 'Partido Nacional Independiente', sigla: 'PNI', color: '#4169E1' },
  { nombre: 'Partido Blanco Radical', sigla: 'PBR', color: '#1E90FF' },
  { nombre: 'Partido Colorado Radical', sigla: 'PCR', color: '#DC143C' },
  { nombre: 'Partido por la Tradición Colorada', sigla: 'PTC', color: '#CD5C5C' },
  { nombre: 'Propuesta Batllista', sigla: 'PROBA', color: '#FF6347' },
  { nombre: 'Unión Socialista Liberal', sigla: 'USL', color: '#7B68EE' },
  { nombre: 'Partido Constitucional', sigla: 'PConst', color: '#708090' },
  { nombre: 'Sin asignar', sigla: 'SA', color: '#999999' },
] as const

const ALIAS_PARTIDOS: Record<string, string> = {
  frenteamplio: 'FA',
  frente: 'FA',
  fa: 'FA',
  nacional: 'PN',
  partidonacional: 'PN',
  blanco: 'PN',
  pn: 'PN',
  colorado: 'PC',
  partidocolorado: 'PC',
  pc: 'PC',
  cabildo: 'CA',
  cabildoabierto: 'CA',
  ca: 'CA',
  independiente: 'PI',
  partidoindependiente: 'PI',
  pi: 'PI',
  ecologista: 'PERI',
  radicalintransigente: 'PERI',
  partidoecologistaradicalintransigente: 'PERI',
  peri: 'PERI',
  popular: 'UP',
  unidadpopular: 'UP',
  up: 'UP',
  asamblea: 'AP',
  asambleapopular: 'AP',
  ap: 'AP',
  nuevo: 'NE',
  nuevoespacio: 'NE',
  ne: 'NE',
  democrata: 'PDC',
  cristiano: 'PDC',
  partidodemocratacristiano: 'PDC',
  pdc: 'PDC',
  socialista: 'PS',
  partidosocialistadeluruguay: 'PS',
  ps: 'PS',
  partidelagente: 'PG',
  partidodelagente: 'PG',
  pg: 'PG',
  partidogeneralfructuosorivera: 'PGFR',
  pgfr: 'PGFR',
  partidocomunistadeluruguay: 'PCU',
  pcu: 'PCU',
  unioncivicadeluruguay: 'UC',
  uc: 'UC',
  unionpopular: 'UPP',
  upp: 'UPP',
  identidadsoberana: 'IS',
  is: 'IS',
  fidel: 'FIDEL',
  partidonacionalindependiente: 'PNI',
  pni: 'PNI',
  partidoblancoradical: 'PBR',
  pbr: 'PBR',
  partidocoloradoradical: 'PCR',
  pcr: 'PCR',
  partidoporlatradicioncolorada: 'PTC',
  ptc: 'PTC',
  propuestabatllista: 'PROBA',
  proba: 'PROBA',
  unionsocialistaliberal: 'USL',
  usl: 'USL',
  partidoconstitucional: 'PConst',
  pconst: 'PConst',
  sinasignar: 'SA',
  sa: 'SA',
}

export function normalizarClavePartido(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function resolverSiglaPartido(texto: string | null | undefined): string | null {
  if (!texto) return null
  const clave = normalizarClavePartido(texto)
  const directo = ALIAS_PARTIDOS[clave]
  if (directo) return directo

  if (clave.includes('frenteamplio') || clave.includes('encuentroprogresista')) {
    return 'FA'
  }
  if (
    clave === 'nacional' ||
    clave.includes('partidonacional') ||
    clave.includes('partidoblanco')
  ) {
    return 'PN'
  }
  if (clave === 'colorado' || clave.includes('partidocolorado')) {
    return 'PC'
  }
  if (clave.includes('cabildoabierto')) {
    return 'CA'
  }
  if (clave.includes('partidoindependiente')) {
    return 'PI'
  }
  if (clave.includes('ecologistaradicalintransigente')) {
    return 'PERI'
  }
  if (clave.includes('partidodelagente')) {
    return 'PG'
  }
  if (clave.includes('identidadsoberana')) {
    return 'IS'
  }

  return null
}

export function seedPartidos(db: DB) {
  for (const partido of PARTIDOS) {
    const existente = db
      .select()
      .from(partidos)
      .where(eq(partidos.sigla, partido.sigla))
      .get()

    if (!existente) {
      db.insert(partidos).values(partido).run()
    }
  }
  console.log(`Partidos insertados: ${PARTIDOS.length}`)
}

export { PARTIDOS }
