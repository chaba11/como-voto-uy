export interface EntradaListado {
  sesionNumero: number
  fecha: string // YYYY-MM-DD
  diarioNumero: number
  resumen: string
  urlDocumentoPagina: string // URL to the /IMG or /SSN page
  tipoDocumento: 'html' | 'pdf'
}

export interface DocumentoDescargado {
  entrada: EntradaListado
  contenido: string // text content
  urlOriginal: string // the infolegislativa URL
}

export type Camara = 'senado' | 'representantes'
