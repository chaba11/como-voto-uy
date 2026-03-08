import pdfParse from 'pdf-parse'

export function extraerTextoDeHtml(html: string): string {
  let texto = html

  // Remove script and style blocks
  texto = texto.replace(/<script[\s\S]*?<\/script>/gi, '')
  texto = texto.replace(/<style[\s\S]*?<\/style>/gi, '')

  // Replace <br>, <p>, <div>, <tr>, <li> with newlines
  texto = texto.replace(/<br\s*\/?>/gi, '\n')
  texto = texto.replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
  texto = texto.replace(/<(?:p|div|tr|li|h[1-6])[^>]*>/gi, '\n')

  // Strip remaining HTML tags
  texto = texto.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  texto = texto.replace(/&nbsp;/g, ' ')
  texto = texto.replace(/&amp;/g, '&')
  texto = texto.replace(/&lt;/g, '<')
  texto = texto.replace(/&gt;/g, '>')
  texto = texto.replace(/&quot;/g, '"')
  texto = texto.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
  texto = texto.replace(/&aacute;/g, 'á')
  texto = texto.replace(/&eacute;/g, 'é')
  texto = texto.replace(/&iacute;/g, 'í')
  texto = texto.replace(/&oacute;/g, 'ó')
  texto = texto.replace(/&uacute;/g, 'ú')
  texto = texto.replace(/&ntilde;/g, 'ñ')
  texto = texto.replace(/&Aacute;/g, 'Á')
  texto = texto.replace(/&Eacute;/g, 'É')
  texto = texto.replace(/&Iacute;/g, 'Í')
  texto = texto.replace(/&Oacute;/g, 'Ó')
  texto = texto.replace(/&Uacute;/g, 'Ú')
  texto = texto.replace(/&Ntilde;/g, 'Ñ')
  texto = texto.replace(/&iquest;/g, '¿')

  // Normalize whitespace: collapse spaces/tabs on each line, then collapse multiple newlines
  texto = texto
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
  texto = texto.replace(/\n{3,}/g, '\n\n')
  texto = texto.trim()

  return texto
}

export async function extraerTextoDePdf(buffer: Buffer): Promise<string> {
  const resultado = await pdfParse(buffer)
  return resultado.text.trim()
}
