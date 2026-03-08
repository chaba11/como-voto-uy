import type { VotacionExtraida } from './tipos-parser.js'

export interface LlmConfig {
  baseUrl: string  // LLM_BASE_URL env var
  apiKey: string   // LLM_API_KEY env var
  model: string    // LLM_MODEL env var
}

export async function parsearConLlm(
  texto: string,
  config: LlmConfig
): Promise<VotacionExtraida[]> {
  // TODO: Implement LLM fallback para votaciones difíciles de parsear con regex
  void texto
  void config
  throw new Error('LLM fallback no implementado')
}
