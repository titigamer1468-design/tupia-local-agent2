// ============================================================================
// DiffManager.js
// Parser y aplicador seguro de bloques SEARCH / REPLACE
// ============================================================================

import { diff_match_patch } from "diff-match-patch";

const dmp = new diff_match_patch();

dmp.Match_Threshold = 0.2;
dmp.Match_Distance = 2000;

const SEARCH_MARKER = "<<<<<<< SEARCH";
const SEPARATOR_MARKER = "=======";
const REPLACE_MARKER = ">>>>>>> REPLACE";

const normalizarSaltos = (texto) => {
  return String(texto ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
};

/**
 * Analiza un bloque con este formato:
 *
 * <<<<<<< SEARCH
 * código original
 * =======
 * código nuevo
 * >>>>>>> REPLACE
 */
export function analizarBloqueReemplazo(textoIA) {
  if (
    typeof textoIA !== "string" ||
    !textoIA.trim()
  ) {
    throw new Error(
      "El bloque de reemplazo está vacío."
    );
  }

  const texto = normalizarSaltos(textoIA);

  const inicio = texto.indexOf(
    SEARCH_MARKER
  );

  const separador = texto.indexOf(
    SEPARATOR_MARKER,
    inicio + SEARCH_MARKER.length
  );

  const fin = texto.indexOf(
    REPLACE_MARKER,
    separador + SEPARATOR_MARKER.length
  );

  if (
    inicio === -1 ||
    separador === -1 ||
    fin === -1 ||
    separador <= inicio ||
    fin <= separador
  ) {
    throw new Error(
      "Formato inválido. Se esperaba SEARCH, ======= y REPLACE."
    );
  }

  const textoSearch = texto
    .slice(
      inicio + SEARCH_MARKER.length,
      separador
    )
    .replace(/^\n/, "")
    .trimEnd();

  const textoReplace = texto
    .slice(
      separador + SEPARATOR_MARKER.length,
      fin
    )
    .replace(/^\n/, "")
    .trimEnd();

  if (!textoSearch.trim()) {
    throw new Error(
      "El bloque SEARCH no puede estar vacío."
    );
  }

  return {
    textoSearch,
    textoReplace
  };
};

/**
 * Aplica un cambio sobre un texto original.
 *
 * Primero intenta coincidencia exacta.
 * Si no existe, intenta patch fuzzy.
 * Si el parche no se aplica completamente, cancela la operación.
 */
export function aplicarCambio(
  textoOriginal,
  bloques
) {
  try {
    const original = normalizarSaltos(
      textoOriginal
    );

    const textoSearch = normalizarSaltos(
      bloques?.textoSearch
    );

    const textoReplace = normalizarSaltos(
      bloques?.textoReplace
    );

    if (!original.trim()) {
      throw new Error(
        "El texto original está vacío."
      );
    }

    if (!textoSearch.trim()) {
      throw new Error(
        "El texto SEARCH está vacío."
      );
    }

    const primeraCoincidencia =
      original.indexOf(textoSearch);

    const segundaCoincidencia =
      original.indexOf(
        textoSearch,
        primeraCoincidencia + 1
      );

    if (primeraCoincidencia !== -1) {
      if (segundaCoincidencia !== -1) {
        throw new Error(
          "El bloque SEARCH aparece varias veces. " +
          "Incluye más contexto para hacerlo único."
        );
      }

      const resultado =
        original.slice(0, primeraCoincidencia) +
        textoReplace +
        original.slice(
          primeraCoincidencia + textoSearch.length
        );

      return {
        exito: true,
        metodo: "exacto",
        textoModificado: resultado
      };
    }

    const parches = dmp.patch_make(
      textoSearch,
      textoReplace
    );

    const [
      textoModificado,
      resultados
    ] = dmp.patch_apply(
      parches,
      original
    );

    const aplicacionCompleta =
      Array.isArray(resultados) &&
      resultados.length > 0 &&
      resultados.every(Boolean);

    if (!aplicacionCompleta) {
      throw new Error(
        "El bloque SEARCH no coincide con el archivo. " +
        "El parche fue cancelado."
      );
    }

    return {
      exito: true,
      metodo: "fuzzy",
      textoModificado
    };
  } catch (error) {
    throw new Error(
      `Error al aplicar el parche: ${
        error?.message || "Error desconocido"
      }`
    );
  }
}

/**
 * Analiza y aplica directamente un bloque IA.
 */
export function aplicarBloque(
  textoOriginal,
  textoIA
) {
  const bloques =
    analizarBloqueReemplazo(textoIA);

  return aplicarCambio(
    textoOriginal,
    bloques
  );
}