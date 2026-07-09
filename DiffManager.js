// DiffManager.js

// 1. Importación de la librería diff-match-patch desde ruta local
import DiffMatchPatch from '../lib/diff-match-patch.js';

// Instancia global de dmp, compartible por todo el módulo
const dmp = new DiffMatchPatch();

// 2. Procesador de bloques de reemplazo IA
/**
 * Analiza un bloque de reemplazo IA con el formato delimitado y lo parsea.
 * Ejemplo esperado:
 * <<<<<<< SEARCH
 * ...texto a buscar...
 * =======
 * ...nuevo texto propuesto...
 * >>>>>>> REPLACE
 * @param {string} textoIA
 * @returns {{ textoSearch: string, textoReplace: string }}
 * @throws Error si el bloque no coincide con el formato exigido
 */
export function analizarBloqueReemplazo(textoIA) {
  // Expresión regular robusta para los delimitadores (insensible a espacios)
  const regex = /<<<<<<<\s*SEARCH\s*\n([\s\S]*?)^=======\s*\n([\s\S]*?)^>>>>>>> REPLACE\s*$/m;

  const match = textoIA.match(regex);
  if (!match) {
    throw new Error(
      "Formato de reemplazo inválido: delimitadores <<<<<<< SEARCH / ======= / >>>>>>> REPLACE no encontrados."
    );
  }
  // Extraemos y limpiamos bordes
  const textoSearch = match[1].trim();
  const textoReplace = match[2].trim();

  return { textoSearch, textoReplace };
}

// 3. Configuración explícita del fuzzy matching (resiliencia IA)
dmp.Match_Threshold = 0.5;    // Intermedia: menos estricto
dmp.Match_Distance = 1000;    // Amplitud de búsqueda amplia

// 4. Motor de parcheo
/**
 * Aplica un cambio inteligente tipo diff-match-patch sobre un texto original.
 * @param {string} textoOriginal   - Código fuente actual
 * @param {{ textoSearch: string, textoReplace: string }} bloques - Bloques del parser
 * @returns {{ exito: boolean, textoModificado: string }}
 */
export function aplicarCambio(textoOriginal, bloques) {
  try {
    const { textoSearch, textoReplace } = bloques;

    // a) Localizar el bloque search usando fuzzy matching
    const indice = dmp.match_main(textoOriginal, textoSearch, 0);

    if (indice === -1) {
      throw new Error(
        "El bloque SEARCH no coincide con ningún fragmento del archivo original. Cancelando parche."
      );
    }

    // b) Calcula la diferencia y diffs
    const diffs = dmp.diff_main(textoSearch, textoReplace);
    dmp.diff_cleanupSemantic(diffs); // Limpieza opcional

    // c) Crear el parche (basado en solo el fragmento afectado)
    const parches = dmp.patch_make(textoSearch, textoReplace, diffs);

    // d) Aplicar el parche únicamente sobre el fragmento detectado
    // Necesitamos reemplazar (en textoOriginal) solo la zona donde match_main dio positivo
    //      original = [antes] + textoSearch + [despues]
    //      => reemplazar textoSearch por textoReplace en ese segmento

    const textoAntes = textoOriginal.slice(0, indice);
    const textoMatch = textoOriginal.slice(indice, indice + textoSearch.length);
    const textoDespues = textoOriginal.slice(indice + textoSearch.length);

    // Aseguramos que el trozo desde el índice coincide para parchar correctamente
    const [textoParcheado] = dmp.patch_apply(
      parches,
      textoMatch
    );

    // Reunimos todo
    const textoModificado = textoAntes + textoParcheado + textoDespues;

    return { exito: true, textoModificado };
  } catch (err) {
    // Gestión clara de errores
    throw new Error(`Error al aplicar el parche: ${err.message}`);
  }
}