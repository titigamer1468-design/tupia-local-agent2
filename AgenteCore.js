// AgenteCore.js (versión ES Modules, lista para NodeJS moderno)

// =======================
// 🚩 1. Importaciones ES Modules
// =======================

import { StateGraph, START, END } from '../lib/langgraph.js';
import { TreeSitterManager, DiffManager } from '../lib/ai.js';

// =======================
// 🚩 2. Definición del estado del agente
// =======================
/**
 * Esquema del estado del agente:
 *  - mensajeUsuario: String
 *  - mapaCodigo: String (AST o estructura generada por TreeSitter)
 *  - planAccion: Array de objetos {}, cada uno representando un paso/tarea de modificación
 */
const estadoInicial = {
  mensajeUsuario: '',   // El requerimiento textual inicial del usuario
  mapaCodigo: '',       // AST o estructura generada
  planAccion: []        // Lista de pasos [{archivo, tipoCambio, detalle, ...}]
};

// =======================
// 🚩 3. System Prompt global
// =======================
export const SYSTEM_PROMPT = "Eres un asistente de código ultra eficiente. Nunca solicites leer un archivo completo. Utiliza la herramienta TreeSitter para obtener un mapa de la estructura. Cuando propongas un cambio, utiliza estrictamente el formato de reemplazo por bloques (Diff-Match-Patch) sin reescribir el archivo.";

// =======================
// 🚩 4. Implementación de nodos/fases asíncronas
// =======================

/**
 * Nodo: evaluarContexto
 * - Utiliza TreeSitterManager para mapear el código de entrada.
 * - Simula el resultado llamando a TreeSitterManager.parseEstructura(mensaje)
 * @param {Object} state
 * @returns {Promise<Object>}
 */
async function evaluarContexto(state) {
  const { mensajeUsuario } = state;

  // Simula la creación de un mapa de estructura (AST del código)
  const mapaCodigo = await TreeSitterManager.parseEstructura(mensajeUsuario);

  // Retornamos nuevo estado (respetando inmutabilidad)
  return {
    ...state,
    mapaCodigo
  };
}

/**
 * Nodo: planificarModificacion
 * - Analiza el mensaje y el mapa de código para sacar una lista de pasos (planAccion)
 * @param {Object} state
 * @returns {Promise<Object>}
 */
async function planificarModificacion(state) {
  const { mensajeUsuario, mapaCodigo } = state;

  // Simulamos una "planificación" simple en base a la entrada
  const planAccion = await TreeSitterManager.generarPlanAccion(mensajeUsuario, mapaCodigo);

  return {
    ...state,
    planAccion
  };
}

/**
 * Nodo: aplicarParches
 * - Aplica cada paso usando DiffManager, simulando bloques diff/match/patch
 * @param {Object} state
 * @returns {Promise<Object>}
 */
async function aplicarParches(state) {
  const { planAccion } = state;
  const logs = [];

  // Procesa cada acción del plan
  for (const accion of planAccion) {
    // Simula la generación de bloque/reemplazo tipo Diff-Match-Patch
    const bloqueReemplazo = await DiffManager.generarBloqueDiff(accion);

    // Llama a DiffManager para aplicar el bloque de parche al sistema de archivos (simulado)
    const resultado = await DiffManager.aplicarBloque(bloqueReemplazo);

    logs.push({
      archivo: accion.archivo,
      descripcion: accion.descripcion,
      resultado
    });
  }

  return {
    ...state,
    logs
  };
}

// =======================
// 🚩 5. Orquestador principal: iniciarCicloAgente
// =======================
/**
 * Orquesta el ciclo de agente usando LangGraph.
 * @param {String} mensaje (requerimiento inicial del usuario)
 * @returns {Promise<Object>} resultado final (output del grafo)
 */
export async function iniciarCicloAgente(mensaje) {
  // 1. Inicializa grafo de estado
  const grafo = new StateGraph();

  // 2. Registra nodos
  grafo.addNode('evaluar', evaluarContexto);
  grafo.addNode('planificar', planificarModificacion);
  grafo.addNode('parchear', aplicarParches);

  // 3. Define las transiciones
  grafo.addEdge(START, 'evaluar');
  grafo.addEdge('evaluar', 'planificar');
  grafo.addEdge('planificar', 'parchear');
  grafo.addEdge('parchear', END);

  // 4. Compila el grafo
  const flujo = grafo.compile();

  // 5. Ejecuta el ciclo con el estado inicial y mensaje del usuario
  const estado = {
    ...estadoInicial,
    mensajeUsuario: mensaje
  };

  // 6. Ejecuta el flujo, recopilando el resultado final
  const resultado = await flujo.run(estado);

  // 7. Imprime y retorna la respuesta final
  console.log("=== RESPUESTA FINAL DEL AGENTE ===");
  console.log(JSON.stringify(resultado, null, 2));

  return resultado;
}

// =======================
// 🚩 Exportaciones públicas y de test
// =======================

export const _nodos = {
  evaluarContexto,
  planificarModificacion,
  aplicarParches
};
