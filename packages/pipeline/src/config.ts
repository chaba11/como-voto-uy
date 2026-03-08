export interface ConfigPipeline {
  rutaDb: string
  datosDir: string // donde cachear documentos descargados
  llmBaseUrl?: string
  llmApiKey?: string
  llmModel?: string
}

export function cargarConfig(): ConfigPipeline {
  return {
    rutaDb: process.env.DB_PATH || 'como-voto.db',
    datosDir: process.env.DATOS_DIR || './data',
    llmBaseUrl: process.env.LLM_BASE_URL,
    llmApiKey: process.env.LLM_API_KEY,
    llmModel: process.env.LLM_MODEL,
  }
}
