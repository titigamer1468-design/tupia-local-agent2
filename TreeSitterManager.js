// TreeSitterManager.js
//
// Universal Tree-sitter utility para frontend (browser/React) - ES Modules
// - Sin importaciones Node.js, sin fs ni path
// - Lee archivos .wasm desde la raíz pública (ej. /public en Vite)
// - Lee archivos fuente desde el navegador (File API: File.text())
// - Motor lógico de indexado AST idéntico

import Parser from 'web-tree-sitter';

// Instancia de parser y lenguaje cacheada a nivel módulo
let parser = null;
let lenguaje = null;
let parserInicializado = false;

/**
 * Inicializa Tree-sitter y el parser específico de lenguaje desde WASM público.
 * Este método es compatible con navegadores modernos.
 */
export async function inicializarParser() {
  if (parserInicializado && parser) return parser;
  await Parser.init();

  // Carga el lenguaje desde la raíz pública (debe estar disponible en /public)
  // Ej: public/tree-sitter-javascript.wasm
  const Lang = await Parser.Language.load('/tree-sitter-javascript.wasm');
  lenguaje = Lang;
  parser = new Parser();
  parser.setLanguage(lenguaje);
  parserInicializado = true;
  return parser;
}

/**
 * Analiza el código fuente y devuelve el nodo raíz (AST).
 * @param {string} codigoFuente
 * @returns {Promise<Parser.Tree.rootNode>}
 */
export async function generarAST(codigoFuente) {
  await inicializarParser();
  const arbol = parser.parse(codigoFuente);
  return arbol.rootNode;
}

/**
 * Extrae un string-índice estructural del AST.
 * Solo incluye:
 *  - Declaraciones de clase con herencia
 *  - Firmas de funciones/métodos (sin cuerpo: usa { ... })
 *  - Declaraciones globales de const
 * @param {Parser.SyntaxNode} nodo
 * @param {number} nivel
 * @returns {string}
 */
export function extraerEsqueleto(nodo, nivel = 0) {
  const IND = '  '.repeat(nivel);
  let resultado = '';

  // CLASE: class_declaration
  if (nodo.type === 'class_declaration') {
    const nombreClase = nodo.childForFieldName('name')?.text || '<anon>';
    const herencia = nodo.childForFieldName('superclass');
    resultado += `${IND}class ${nombreClase}`;
    if (herencia) resultado += ` extends ${herencia.text}`;
    resultado += ' {\n';
    // Recorre miembros, NO desciende en los cuerpos de métodos
    const cuerpo = nodo.childForFieldName('body');
    if (cuerpo) {
      for (const miembro of cuerpo.namedChildren) {
        resultado += extraerEsqueleto(miembro, nivel + 1);
      }
    }
    resultado += `${IND}}\n`;
    return resultado;
  }

  // FUNCIÓN: function_declaration, method_definition
  if (
    nodo.type === 'function_declaration' ||
    nodo.type === 'method_definition'
  ) {
    let nombre =
      nodo.childForFieldName('name')?.text ||
      nodo.childForFieldName('property')?.text ||
      '<anon>';
    let parametros = '';
    const paramNode = nodo.childForFieldName('parameters');
    if (paramNode) parametros = paramNode.text;
    let tipoRetorno = '';
    const typeNode = nodo.childForFieldName('return_type');
    if (typeNode) tipoRetorno = `: ${typeNode.text}`;

    resultado += `${IND}function ${nombre}${parametros}${tipoRetorno} { ... }\n`;
    return resultado;
  }

  // VARIABLE estructural: variable_declaration (solo const/global)
  if (
    nodo.type === 'variable_declaration' &&
    nodo.firstChild?.text === 'const' &&
    nivel === 0
  ) {
    for (const declarador of nodo.namedChildren) {
      if (declarador.type === 'variable_declarator') {
        const nombre = declarador.childForFieldName('name')?.text || '<anon>';
        resultado += `${IND}const ${nombre}\n`;
      }
    }
    return resultado;
  }

  // Recursión limitada: para program, statement_block, export_statement
  if (
    nodo.type === 'program' ||
    nodo.type === 'statement_block' ||
    nodo.type === 'export_statement'
  ) {
    for (const hijo of nodo.namedChildren) {
      resultado += extraerEsqueleto(hijo, nivel);
    }
    return resultado;
  }

  // Otros nodos no relevantes estructuralmente
  return '';
}

/**
 * Interfaz principal: Analiza un objeto File HTML5
 * @param {File} archivoWeb - Un objeto File tomado desde input o drag'n'drop
 * @returns {Promise<string>} - String estructurado del esqueleto
 */
export async function obtenerMapaCodigo(archivoWeb) {
  // Usa la API File estándar del navegador
  const codigoFuente = await archivoWeb.text();

  // AST y esqueleto
  const nodoRaiz = await generarAST(codigoFuente);
  const esqueleto = extraerEsqueleto(nodoRaiz);
  return esqueleto.trim();
}
