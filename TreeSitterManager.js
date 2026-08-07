// ============================================================================
// TreeSitterManager.js
// Analizador estructural de archivos JavaScript y JSX en navegador
// ============================================================================

import Parser from "web-tree-sitter";

let parser = null;
let lenguaje = null;
let inicializacion = null;

const LANGUAGE_WASM = "/tree-sitter-javascript.wasm";

const isString = (value) =>
  typeof value === "string";

const safeText = (value, fallback = "") =>
  isString(value) ? value : fallback;

/**
 * Inicializa Tree-sitter una sola vez.
 * Evita inicializaciones simultáneas del parser.
 */
export async function inicializarParser() {
  if (parser && lenguaje) {
    return parser;
  }

  if (inicializacion) {
    return inicializacion;
  }

  inicializacion = (async () => {
    await Parser.init();

    lenguaje = await Parser.Language.load(
      LANGUAGE_WASM
    );

    parser = new Parser();
    parser.setLanguage(lenguaje);

    return parser;
  })();

  try {
    return await inicializacion;
  } catch (error) {
    parser = null;
    lenguaje = null;
    inicializacion = null;

    throw new Error(
      `No se pudo inicializar Tree-sitter: ${
        error?.message || "Error desconocido"
      }`
    );
  }
}

/**
 * Genera el AST de un texto JavaScript o JSX.
 */
export async function generarAST(codigoFuente) {
  const codigo = safeText(codigoFuente);

  if (!codigo.trim()) {
    throw new Error("El código fuente está vacío.");
  }

  const motor = await inicializarParser();
  const arbol = motor.parse(codigo);

  if (!arbol?.rootNode) {
    throw new Error("Tree-sitter no generó un árbol válido.");
  }

  return arbol.rootNode;
}

const obtenerNombreNodo = (nodo) => {
  return (
    nodo?.childForFieldName?.("name")?.text ||
    nodo?.childForFieldName?.("property")?.text ||
    "<anónimo>"
  );
};

const obtenerParametros = (nodo) => {
  return nodo?.childForFieldName?.("parameters")?.text || "()";
};

const esFuncion = (tipo) => {
  return [
    "function_declaration",
    "function_expression",
    "method_definition",
    "generator_function_declaration"
  ].includes(tipo);
};

const esContenedor = (tipo) => {
  return [
    "program",
    "export_statement",
    "statement_block",
    "class_body",
    "lexical_declaration",
    "variable_declaration"
  ].includes(tipo);
};

/**
 * Extrae un mapa estructural compacto del AST.
 */
export function extraerEsqueleto(nodo, nivel = 0) {
  if (!nodo) {
    return "";
  }

  const indentacion = "  ".repeat(nivel);
  const tipo = nodo.type;
  let resultado = "";

  if (tipo === "class_declaration") {
    const nombre = obtenerNombreNodo(nodo);
    const padre =
      nodo.childForFieldName?.("superclass")?.text || "";

    resultado += `${indentacion}class ${nombre}`;

    if (padre) {
      resultado += ` extends ${padre}`;
    }

    resultado += " {\n";

    const cuerpo =
      nodo.childForFieldName?.("body");

    for (const hijo of cuerpo?.namedChildren || []) {
      resultado += extraerEsqueleto(
        hijo,
        nivel + 1
      );
    }

    resultado += `${indentacion}}\n`;

    return resultado;
  }

  if (esFuncion(tipo)) {
    const nombre = obtenerNombreNodo(nodo);
    const parametros = obtenerParametros(nodo);

    resultado +=
      `${indentacion}function ` +
      `${nombre}${parametros} { ... }\n`;

    return resultado;
  }

  if (
    tipo === "variable_declaration" ||
    tipo === "lexical_declaration"
  ) {
    const palabra =
      nodo.firstChild?.text || "const";

    for (const declarador of nodo.namedChildren || []) {
      if (declarador.type !== "variable_declarator") {
        continue;
      }

      const nombre =
        declarador.childForFieldName?.("name")?.text ||
        "<anónimo>";

      const valor =
        declarador.childForFieldName?.("value");

      const esFuncionFlecha =
        valor?.type === "arrow_function";

      if (esFuncionFlecha) {
        resultado +=
          `${indentacion}${palabra} ${nombre} = ` +
          `(...) => { ... }\n`;
      } else {
        resultado +=
          `${indentacion}${palabra} ${nombre}\n`;
      }
    }

    return resultado;
  }

  if (esContenedor(tipo)) {
    for (const hijo of nodo.namedChildren || []) {
      resultado += extraerEsqueleto(
        hijo,
        nivel
      );
    }

    return resultado;
  }

  return "";
}

/**
 * Analiza un objeto File del navegador.
 */
export async function obtenerMapaCodigo(archivoWeb) {
  if (!archivoWeb || typeof archivoWeb.text !== "function") {
    throw new Error(
      "Debes proporcionar un archivo válido."
    );
  }

  const codigoFuente = await archivoWeb.text();
  return obtenerMapaDesdeTexto(codigoFuente);
}

/**
 * Analiza directamente un string de código.
 */
export async function obtenerMapaDesdeTexto(codigoFuente) {
  const codigo = safeText(codigoFuente);

  if (!codigo.trim()) {
    return "";
  }

  const nodoRaiz = await generarAST(codigo);
  const mapa = extraerEsqueleto(nodoRaiz);

  return mapa.trim();
}

/**
 * Alias compatible para otros módulos.
 */
export async function parseEstructura(entrada) {
  if (
    entrada &&
    typeof entrada.text === "function"
  ) {
    return obtenerMapaCodigo(entrada);
  }

  return obtenerMapaDesdeTexto(entrada);
}