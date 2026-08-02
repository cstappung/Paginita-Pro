"use strict";
/* ============================================================
   ColabTeX — Asistente IA multi-proveedor (BYOK)
   La clave del usuario vive solo en SU navegador (localStorage).
   Se llama a la API del proveedor directamente desde el navegador
   (sin backend) y el modelo edita los archivos del proyecto vía
   herramientas (tool/function calling) que operan sobre el
   documento Yjs → los cambios son colaborativos y en vivo.

   Proveedores:
     - google    (Gemini)  ← capa GRATUITA: API key gratis en AI Studio
     - anthropic (Claude)  ← API de pago
     - openai    (ChatGPT) ← API de pago
   ============================================================ */
import { escapeHtml } from "./util.js";

const $ = id => document.getElementById(id);

const PROVIDER_STORE = "colabtex_ai_provider";
const MAX_TOKENS = 4096;
const MAX_TURNS = 16;

/* ---------- herramientas (esquema neutral JSON-Schema) ---------- */
function toolDefs(readOnly) {
  const tools = [
    { name: "list_files", description: "Lista todos los archivos del proyecto (textos/LaTeX editables y recursos binarios como imágenes o PDF).",
      parameters: { type: "object", properties: {}, required: [] } },
    { name: "read_file", description: "Lee el contenido completo de un archivo de texto/LaTeX (p. ej. main.tex).",
      parameters: { type: "object", properties: { path: { type: "string", description: "Ruta, p. ej. 'main.tex' o 'secciones/intro.tex'." } }, required: ["path"] } },
    { name: "get_compile_log", description: "Devuelve el resultado de la última compilación (errores/advertencias de pdfTeX) para diagnosticar por qué no compila.",
      parameters: { type: "object", properties: {}, required: [] } }
  ];
  if (readOnly) return tools;
  tools.push(
    { name: "str_replace", description: "Reemplaza UNA única aparición exacta de 'old_str' por 'new_str' en un archivo. Para ediciones puntuales. 'old_str' debe aparecer exactamente una vez.",
      parameters: { type: "object", properties: {
        path: { type: "string" },
        old_str: { type: "string", description: "Texto exacto a reemplazar, con suficiente contexto para ser único." },
        new_str: { type: "string", description: "Texto nuevo." } }, required: ["path", "old_str", "new_str"] } },
    { name: "write_file", description: "Crea un archivo nuevo o reescribe por completo uno existente. Para cambios pequeños prefiere str_replace.",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    { name: "create_folder", description: "Crea una carpeta vacía (p. ej. 'figuras' o 'capitulos/anexos').",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }
  );
  return tools;
}

const TOOL_LABEL = {
  list_files: () => "📁 listó los archivos",
  read_file: i => "📖 leyó " + (i.path || "?"),
  get_compile_log: () => "📋 revisó el registro de compilación",
  str_replace: i => "✎ editó " + (i.path || "?"),
  write_file: i => "✚ escribió " + (i.path || "?"),
  create_folder: i => "📂 creó la carpeta " + (i.path || "?")
};

/* JSON-Schema → esquema Gemini (tipos en MAYÚSCULA; sin parámetros vacíos) */
function toGeminiSchema(s) {
  if (!s || typeof s !== "object") return s;
  const out = {};
  for (const k in s) {
    if (k === "type" && typeof s[k] === "string") out[k] = s[k].toUpperCase();
    else if (k === "properties") { out.properties = {}; for (const p in s.properties) out.properties[p] = toGeminiSchema(s.properties[p]); }
    else if (k === "items") out.items = toGeminiSchema(s.items);
    else out[k] = s[k];
  }
  return out;
}

/* ---------- extraer mensaje de error de una respuesta HTTP ---------- */
async function readError(res) {
  try { const j = await res.json(); if (j.error) return j.error.message || JSON.stringify(j.error); return JSON.stringify(j); }
  catch (e) { return (await res.text().catch(() => "")) || ("HTTP " + res.status); }
}

/* ============================================================
   ADAPTADORES POR PROVEEDOR
   Cada uno maneja su propio formato de `messages`. Al cambiar de
   proveedor se reinicia la conversación, así que nunca se mezclan.
   ============================================================ */
const PROVIDERS = {
  google: {
    label: "Gemini (Google) — gratis",
    keyStore: "colabtex_key_google",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza… o AQ…",
    free: true,
    /* Red de seguridad: la lista de verdad se pide a la API (listModels).
       Solo Flash — desde abril de 2026 los Pro NO tienen capa gratuita. */
    models: { "gemini-3.5-flash": "Gemini 3.5 Flash (gratis)", "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite (gratis)", "gemini-2.5-flash": "Gemini 2.5 Flash (gratis)" },
    defaultModel: "gemini-3.5-flash",
    listModels: async key => {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key));
      if (!r.ok) throw new Error(await readError(r));
      const out = {};
      for (const m of (await r.json()).models || []) {
        const id = String(m.name || "").replace(/^models\//, "");
        /* generateContent es lo que usamos; sin él el modelo no sirve aquí
           (embeddings, TTS, imagen…). Fuera también los previews, que traen
           límites aún más estrechos y desaparecen sin avisar. */
        if (!(m.supportedGenerationMethods || []).includes("generateContent")) continue;
        if (/preview|exp|embedding|aqa|image|tts|live/i.test(id)) continue;
        out[id] = (m.displayName || id) + (/flash/i.test(id) ? " (gratis)" : " (de pago)");
      }
      return out;
    },
    // Google emite varios formatos de clave (AIza…, AQ.…); no encasillar
    validateKey: k => k.trim().length >= 20,
    formatTools(defs) {
      const fns = defs.map(d => {
        const fd = { name: d.name, description: d.description };
        if (d.parameters && d.parameters.properties && Object.keys(d.parameters.properties).length)
          fd.parameters = toGeminiSchema(d.parameters);
        return fd;
      });
      return [{ function_declarations: fns }];
    },
    buildRequest({ model, key, system, tools, messages }) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        headers: { "content-type": "application/json" },
        body: {
          system_instruction: { parts: [{ text: system }] },
          contents: messages,
          tools,
          generationConfig: { maxOutputTokens: MAX_TOKENS }
        }
      };
    },
    parse(data) {
      const cand = data.candidates && data.candidates[0];
      if (!cand) {
        const fb = data.promptFeedback && data.promptFeedback.blockReason;
        return { texts: [], toolCalls: [], stopped: true, error: fb ? "Contenido bloqueado por seguridad: " + fb : "Respuesta vacía del modelo." };
      }
      const parts = (cand.content && cand.content.parts) || [];
      const texts = [], toolCalls = [];
      parts.forEach((p, idx) => {
        if (p.text) texts.push(p.text);
        else if (p.functionCall) toolCalls.push({ id: p.functionCall.name + "#" + idx, name: p.functionCall.name, input: p.functionCall.args || {} });
      });
      return { texts, toolCalls, stopped: toolCalls.length === 0 };
    },
    pushUserText(messages, text) { messages.push({ role: "user", parts: [{ text }] }); },
    pushAssistant(messages, data) {
      const c = (data.candidates && data.candidates[0] && data.candidates[0].content) || { role: "model", parts: [] };
      messages.push(c);
    },
    pushToolResults(messages, results) {
      messages.push({ role: "user", parts: results.map(r => ({ functionResponse: { name: r.name, response: { result: String(r.content) } } })) });
    }
  },

  anthropic: {
    label: "Claude (Anthropic) — de pago",
    keyStore: "colabtex_key_anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-…",
    free: false,
    models: { "claude-sonnet-5": "Sonnet 5 (equilibrado)", "claude-haiku-4-5-20251001": "Haiku 4.5 (barato)", "claude-opus-5": "Opus 5 (máx. capacidad)" },
    defaultModel: "claude-sonnet-5",
    validateKey: k => k.startsWith("sk-ant-"),
    listModels: async key => {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=100", {
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
      });
      if (!r.ok) throw new Error(await readError(r));
      const out = {};
      for (const m of (await r.json()).data || []) if (m.id) out[m.id] = m.display_name || m.id;
      return out;
    },
    formatTools(defs) { return defs.map(d => ({ name: d.name, description: d.description, input_schema: d.parameters })); },
    buildRequest({ model, key, system, tools, messages }) {
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: { model, max_tokens: MAX_TOKENS, system, tools, messages }
      };
    },
    parse(data) {
      const texts = [], toolCalls = [];
      for (const b of data.content || []) {
        if (b.type === "text" && b.text.trim()) texts.push(b.text);
        else if (b.type === "tool_use") toolCalls.push({ id: b.id, name: b.name, input: b.input || {} });
      }
      return { texts, toolCalls, stopped: data.stop_reason !== "tool_use" || toolCalls.length === 0 };
    },
    pushUserText(messages, text) { messages.push({ role: "user", content: text }); },
    pushAssistant(messages, data) { messages.push({ role: "assistant", content: data.content }); },
    pushToolResults(messages, results) {
      messages.push({ role: "user", content: results.map(r => ({ type: "tool_result", tool_use_id: r.id, content: String(r.content), ...(r.isError ? { is_error: true } : {}) })) });
    }
  },

  openai: {
    label: "ChatGPT (OpenAI) — de pago",
    keyStore: "colabtex_key_openai",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-…",
    free: false,
    models: { "gpt-4o-mini": "GPT-4o mini (barato)", "gpt-4o": "GPT-4o", "gpt-4.1-mini": "GPT-4.1 mini" },
    defaultModel: "gpt-4o-mini",
    validateKey: k => k.startsWith("sk-"),
    listModels: async key => {
      const r = await fetch("https://api.openai.com/v1/models", { headers: { authorization: "Bearer " + key } });
      if (!r.ok) throw new Error(await readError(r));
      const out = {};
      /* /v1/models lo devuelve TODO (voz, imagen, embeddings…); aquí solo
         sirven los de chat con function calling. */
      for (const m of (await r.json()).data || []) {
        const id = String(m.id || "");
        if (!/^(gpt|o[134])/.test(id)) continue;
        if (/instruct|audio|realtime|image|tts|transcribe|search|embedding|moderation|\d{4}-\d{2}-\d{2}$/.test(id)) continue;
        out[id] = id;
      }
      return out;
    },
    formatTools(defs) { return defs.map(d => ({ type: "function", function: { name: d.name, description: d.description, parameters: d.parameters } })); },
    buildRequest({ model, key, system, tools, messages }) {
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: { "content-type": "application/json", "authorization": "Bearer " + key },
        body: { model, max_tokens: MAX_TOKENS, messages: [{ role: "system", content: system }, ...messages], tools, tool_choice: "auto" }
      };
    },
    parse(data) {
      const choice = data.choices && data.choices[0];
      const msg = (choice && choice.message) || {};
      const texts = msg.content ? [msg.content] : [];
      const toolCalls = (msg.tool_calls || []).map(tc => {
        let input = {};
        try { input = JSON.parse(tc.function.arguments || "{}"); } catch (e) {}
        return { id: tc.id, name: tc.function.name, input };
      });
      return { texts, toolCalls, stopped: toolCalls.length === 0 };
    },
    pushUserText(messages, text) { messages.push({ role: "user", content: text }); },
    pushAssistant(messages, data) { messages.push((data.choices && data.choices[0] && data.choices[0].message) || { role: "assistant", content: "" }); },
    pushToolResults(messages, results) {
      for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: String(r.content) });
    }
  }
};

/* ---------- render markdown mínimo y seguro ---------- */
function mdToHtml(src) {
  const parts = String(src).split(/```/);
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const body = parts[i].replace(/^[a-zA-Z0-9-]*\n/, "");
      out += `<pre class="ai-code">${escapeHtml(body.replace(/\n$/, ""))}</pre>`;
    } else {
      let t = escapeHtml(parts[i]);
      t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
      t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/\n/g, "<br>");
      out += t;
    }
  }
  return out;
}

/* ============================================================
   CATÁLOGO DE MODELOS

   Los IDs se retiran cada pocos meses: «gemini-2.0-flash» se apagó el
   1 de junio de 2026 y dejó al asistente pidiendo un modelo inexistente.
   La API contesta entonces que no queda cuota gratuita — un mensaje que
   parece de facturación y no lo es, así que nadie lo relaciona con el
   modelo. Para que no vuelva a pasar, la lista de verdad se le pregunta
   al proveedor; la escrita a mano queda solo de red, para que el
   desplegable nunca aparezca vacío.
   ============================================================ */
const MODELS_TTL = 24 * 3600 * 1000;
const modelsStore = prov => "colabtex_ai_models_" + prov;

export function readModelCache(prov, now = Date.now()) {
  try {
    const c = JSON.parse(localStorage.getItem(modelsStore(prov)) || "null");
    if (!c || !c.models || !Object.keys(c.models).length) return null;
    return (now - (c.at || 0) < MODELS_TTL) ? c.models : null;
  } catch (e) { return null; }
}

function writeModelCache(prov, models) {
  try { localStorage.setItem(modelsStore(prov), JSON.stringify({ at: Date.now(), models })); } catch (e) {}
}

export const modelsOf = prov => readModelCache(prov) || PROVIDERS[prov].models;

/* Un modelo guardado que ya no exista cae al de por defecto; y si el de
   por defecto tampoco sigue vivo, al primero del catálogo. Nunca se
   devuelve algo que el proveedor ya no acepte. */
export function chooseModel(prov, stored, catalog) {
  const list = catalog || modelsOf(prov);
  if (stored && list[stored]) return stored;
  const def = PROVIDERS[prov].defaultModel;
  return list[def] ? def : (Object.keys(list)[0] || def);
}

export function createAssistant(api) {
  let provider = localStorage.getItem(PROVIDER_STORE) || "google";
  if (!PROVIDERS[provider]) provider = "google";
  let model = pickModel(provider);
  let messages = [];
  let running = false;

  const panel = $("aiPanel");
  const setup = $("aiSetup");
  const msgBox = $("aiMessages");
  const input = $("aiInput");
  const sendBtn = $("aiSend");
  const providerSel = $("aiProvider");
  const modelSel = $("aiModel");

  function pickModel(prov) {
    return chooseModel(prov, localStorage.getItem("colabtex_ai_model_" + prov));
  }
  const adapter = () => PROVIDERS[provider];
  const getKey = () => localStorage.getItem(adapter().keyStore);
  const hasKey = () => !!getKey();

  /* poblar selector de proveedor */
  providerSel.innerHTML = "";
  for (const [id, p] of Object.entries(PROVIDERS)) {
    const o = document.createElement("option");
    o.value = id; o.textContent = p.label;
    providerSel.appendChild(o);
  }
  providerSel.value = provider;

  function fillModels() {
    modelSel.innerHTML = "";
    for (const [id, label] of Object.entries(modelsOf(provider))) {
      const o = document.createElement("option");
      o.value = id; o.textContent = label;
      modelSel.appendChild(o);
    }
    modelSel.value = model;
  }

  /* Pide al proveedor qué modelos acepta esta clave. Silencioso a
     propósito: si falla (sin red, clave recién pegada, endpoint caído) nos
     quedamos con la lista fija y el asistente sigue funcionando. */
  async function refreshModels(force) {
    const p = adapter(), key = getKey(), prov = provider;
    if (!p.listModels || !key) return;
    if (!force && readModelCache(prov)) return;
    try {
      const list = await p.listModels(key);
      if (!Object.keys(list).length) return;
      writeModelCache(prov, list);
      if (prov !== provider) return;            // cambió de proveedor mientras tanto
      model = chooseModel(prov, model, list);
      fillModels();
    } catch (e) { /* nos quedamos con la lista de respaldo */ }
  }

  fillModels();
  refreshModels();

  providerSel.onchange = () => {
    provider = providerSel.value;
    localStorage.setItem(PROVIDER_STORE, provider);
    model = pickModel(provider);
    fillModels();
    refreshModels();
    reset();
    if (!hasKey()) showSetup(""); else hideSetup();
    renderSetup();
  };
  modelSel.onchange = () => { model = modelSel.value; localStorage.setItem("colabtex_ai_model_" + provider, model); };

  /* ----- setup dinámico por proveedor ----- */
  function renderSetup() {
    const p = adapter();
    const lead = $("aiSetupLead"), steps = $("aiSetupSteps");
    lead.innerHTML = p.free
      ? "<b>" + escapeHtml(p.label.split(" — ")[0]) + "</b> tiene una <b>capa gratuita</b>: puedes crear una API key gratis (sin tarjeta) y usarla sin costo dentro de los límites diarios. La clave se guarda solo en <b>este navegador</b>."
      : "Conéctate con tu propia <b>API key</b> de <b>" + escapeHtml(p.label.split(" — ")[0]) + "</b>. El uso se cobra a tu cuenta del proveedor (de pago). La clave se guarda solo en <b>este navegador</b>.";
    steps.innerHTML =
      `<li>Entra a <a href="${p.keyUrl}" target="_blank" rel="noopener">${escapeHtml(p.keyUrl.replace(/^https?:\/\//, ""))}</a>.</li>` +
      `<li>Crea una clave y cópiala (empieza por <code>${escapeHtml(p.keyHint)}</code>).</li>` +
      (p.free ? "<li><b>Elige «crear en un proyecto nuevo»</b>. Un proyecto con facturación activada sale del nivel gratuito y fallará aunque uses modelos gratis.</li>" : "") +
      `<li>Pégala aquí abajo.</li>`;
    input && ($("aiKeyInput").placeholder = p.keyHint);
  }

  function showSetup(msg) {
    renderSetup();
    setup.style.display = "block";
    msgBox.style.display = "none";
    $("aiComposer").style.display = "none";
    $("aiSetupMsg").textContent = msg || "";
  }
  function hideSetup() {
    setup.style.display = "none";
    msgBox.style.display = "block";
    $("aiComposer").style.display = "flex";
  }

  /* ----- burbujas ----- */
  function addBubble(role, html) {
    const div = document.createElement("div");
    div.className = "ai-msg ai-" + role;
    div.innerHTML = html;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
    return div;
  }
  function addChip(text) {
    const div = document.createElement("div");
    div.className = "ai-chip";
    div.textContent = text;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
  }
  const addError = text => addBubble("error", escapeHtml(text));

  /* ----- ejecución de herramientas (idéntica para todos) ----- */
  function runTool(name, inputObj) {
    const readOnly = api.isReadOnly();
    try {
      switch (name) {
        case "list_files": {
          const f = api.listFiles();
          return { text: "Archivos de texto:\n" + (f.tex.join("\n") || "(ninguno)") +
                         "\n\nRecursos (imágenes/PDF):\n" + (f.assets.join("\n") || "(ninguno)") +
                         "\n\nArchivo principal: " + api.getMainFile() };
        }
        case "read_file": {
          const c = api.readFile(inputObj.path);
          if (c == null) return { text: "No existe el archivo de texto: " + inputObj.path, error: true };
          return { text: c };
        }
        case "get_compile_log": {
          const log = api.getLastLog();
          if (!log) return { text: "Todavía no se ha compilado el proyecto en esta sesión." };
          return { text: (log.ok ? "Última compilación: correcta.\n" : "Última compilación: FALLÓ.\n") +
                         "Errores:\n" + (log.errors.join("\n") || "(ninguno)") +
                         "\n\nAdvertencias:\n" + (log.warnings.slice(0, 20).join("\n") || "(ninguna)") };
        }
        case "str_replace":
          if (readOnly) return { text: "El proyecto es de solo lectura; no puedes editar.", error: true };
          api.strReplace(inputObj.path, inputObj.old_str, inputObj.new_str);
          return { text: "OK, editado " + inputObj.path };
        case "write_file":
          if (readOnly) return { text: "El proyecto es de solo lectura; no puedes editar.", error: true };
          api.writeFile(inputObj.path, inputObj.content);
          return { text: "OK, escrito " + inputObj.path };
        case "create_folder":
          if (readOnly) return { text: "El proyecto es de solo lectura; no puedes editar.", error: true };
          api.createFolder(inputObj.path);
          return { text: "OK, carpeta creada: " + inputObj.path };
        default:
          return { text: "Herramienta desconocida: " + name, error: true };
      }
    } catch (e) {
      return { text: "Error: " + (e.message || String(e)), error: true };
    }
  }

  function buildSystem() {
    const readOnly = api.isReadOnly();
    const files = api.listFiles();
    return (
      "Eres un asistente experto en LaTeX integrado en ColabTeX, un editor colaborativo " +
      "que compila con pdfTeX en el navegador. Ayudas a la persona a redactar y corregir su documento.\n" +
      "- Puedes leer y editar los archivos del proyecto con las herramientas disponibles.\n" +
      "- Haz cambios mínimos y precisos: usa str_replace para ediciones puntuales y write_file solo para archivos nuevos o reescrituras completas.\n" +
      "- Si no conoces el contenido de un archivo antes de editarlo, léelo primero.\n" +
      "- Se compila con pdfTeX (no XeLaTeX/LuaLaTeX): evita paquetes incompatibles como fontspec.\n" +
      "- Explica brevemente lo que haces y responde en el idioma de la persona (español por defecto).\n" +
      (readOnly ? "- IMPORTANTE: el proyecto está en modo SOLO LECTURA; no puedes editar, solo sugerir.\n" : "") +
      "\nArchivo principal de compilación: " + api.getMainFile() +
      "\nArchivos de texto: " + (files.tex.join(", ") || "(ninguno)") +
      "\nRecursos: " + (files.assets.join(", ") || "(ninguno)")
    );
  }

  /* Traduce el fallo de la API a algo accionable. Vive aparte del `catch`
     porque la comprobación de la clave recién guardada usa exactamente el
     mismo diagnóstico. */
  function reportError(e) {
    if (/denied access|project.*(?:blocked|suspended)/i.test(e.message || "")) {
      /* «Your project has been denied access» (403). Ojo: NO es la clave.
         Con una clave así, listar modelos y contar tokens responden 200 y
         solo generateContent da 403 — es un bloqueo que Google pone sobre
         el proyecto entero, y no se arregla creando otra clave dentro de
         él. Decir «tu API key no es válida», que es lo que hacíamos, manda
         al usuario a repetir en bucle el paso que no falla. */
      addError("Google ha bloqueado el acceso del PROYECTO al que pertenece esta clave.\n\n" +
        "No es un problema de la clave (con ella se pueden listar los modelos), ni tuyo, ni de esta página: " +
        "es una decisión del lado de Google sobre ese proyecto. Suele pasar con cuentas recién creadas, " +
        "con cuentas institucionales y con proyectos marcados automáticamente.\n\n" +
        "Qué hacer: entra en aistudio.google.com/apikey con OTRA cuenta de Google (una de Gmail personal y con " +
        "cierta antigüedad) y crea ahí la clave. Crear otra clave dentro del mismo proyecto no sirve. " +
        "Si no tienes otra cuenta, usa Claude o ChatGPT en el desplegable de arriba.");
    }
    else if (e.status === 401 || e.status === 403) addError("Tu API key no es válida, expiró o no tiene permiso. Vuelve a configurarla con ⚙.");
    else if (e.status === 404 || /not found|not supported|does not exist/i.test(e.message || "")) {
      /* Un modelo retirado da esto. Refrescamos el catálogo para que el
         desplegable vuelva a mostrar solo lo que existe hoy. */
      addError("El modelo «" + model + "» ya no existe o tu cuenta no lo tiene.\n" +
        "Estoy actualizando la lista de modelos: elígelo de nuevo arriba y vuelve a intentarlo.");
      refreshModels(true);
    } else if (/prepay|credits?\s+are\s+depleted|billing/i.test(e.message || "")) {
      /* El proyecto de la clave TIENE facturación activada. En cuanto un
         proyecto se vincula a una cuenta de facturación deja el nivel
         gratuito, así que la capa gratuita ya no se le aplica y, sin
         saldo, falla TODO — Flash incluido. No es un límite alcanzado ni
         un problema del modelo: hay que usar una clave de un proyecto sin
         facturación. */
      addError("Tu clave pertenece a un proyecto de Google CON facturación activada y sin saldo.\n\n" +
        "Eso no es haber agotado la cuota: al vincular una cuenta de facturación, el proyecto SALE del nivel gratuito, " +
        "así que ya no hay capa gratuita que usar y fallan todos los modelos, incluidos los Flash.\n\n" +
        "Arreglo (2 minutos): entra en aistudio.google.com/apikey, crea una clave nueva y elige «crear en un proyecto NUEVO». " +
        "Un proyecto sin facturación sí tiene capa gratuita. Después pégala aquí con ⚙.");
    } else if (e.status === 429 && /limit:\s*0/.test(e.message || "")) {
      /* limit: 0 = ese proyecto NUNCA tuvo cuota para este modelo. Suele ser
         un modelo sin capa gratuita (los Pro, desde abril de 2026) o una
         cuenta institucional con la capa gratuita bloqueada. */
      addError("Tu cuenta no tiene cuota gratuita para «" + model + "» (limit: 0). No es que la hayas agotado: nunca la tuvo.\n\n" +
        "Prueba con un modelo Flash, que son los únicos gratuitos. Si tampoco funciona, crea la clave en AI Studio " +
        "con una cuenta de Gmail PERSONAL (no institucional/UC) y elige «crear en un proyecto nuevo»: las cuentas de " +
        "universidad suelen traer la capa gratuita bloqueada.");
      refreshModels(true);
    } else if (e.status === 429) addError("Límite de uso alcanzado (429). " + (adapter().free ? "Agotaste la cuota del momento. Ojo: una conversación con herramientas puede gastar varias peticiones, así que en la capa gratuita se toca antes el límite DIARIO que el de por minuto." : "Revisa el saldo/límites de tu cuenta.") + "\n" + (e.message || ""));
    else if (e.status === 400) addError("La API rechazó la solicitud (400): " + e.message);
    else addError("No se pudo contactar al modelo: " + (e.message || String(e)) + "\nRevisa tu conexión y que la API key sea correcta.");
  }

  /* Al guardar una clave se hace UNA petición de verdad. Listar modelos no
     sirve como prueba: un proyecto bloqueado por Google, o sin capa
     gratuita, contesta 200 a la lista y solo falla al generar — así que el
     usuario se enteraba al primer mensaje y creía que la culpa era suya. */
  async function probeKey() {
    const a = adapter(), key = getKey();
    if (!key) return;
    const msgs = [];
    a.pushUserText(msgs, "ok");
    try {
      const { url, headers, body } = a.buildRequest({
        model, key, system: "Responde solo: ok.", tools: a.formatTools(toolDefs(true)), messages: msgs
      });
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (res.ok) return true;
      const err = new Error(await readError(res));
      err.status = res.status;
      throw err;
    } catch (e) {
      reportError(e);
      return false;
    }
  }

  /* ----- turno completo con bucle de herramientas ----- */
  async function send() {
    if (running) return;
    const text = input.value.trim();
    if (!text) return;
    if (!hasKey()) { showSetup("Primero configura tu API key."); return; }

    input.value = "";
    input.style.height = "auto";
    addBubble("user", mdToHtml(text));
    adapter().pushUserText(messages, text);

    running = true;
    sendBtn.disabled = true;
    const thinking = addBubble("thinking", "Pensando…");

    try {
      const readOnly = api.isReadOnly();
      const tools = adapter().formatTools(toolDefs(readOnly));
      let turns = 0;
      while (turns++ < MAX_TURNS) {
        const a = adapter();
        const { url, headers, body } = a.buildRequest({ model, key: getKey(), system: buildSystem(), tools, messages });
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        if (!res.ok) { const msg = await readError(res); const err = new Error(msg); err.status = res.status; throw err; }
        const data = await res.json();

        const parsed = a.parse(data);
        if (parsed.error) { addError(parsed.error); break; }
        for (const t of parsed.texts) if (t.trim()) addBubble("bot", mdToHtml(t));
        a.pushAssistant(messages, data);

        if (parsed.stopped || parsed.toolCalls.length === 0) break;

        const results = [];
        for (const tc of parsed.toolCalls) {
          addChip((TOOL_LABEL[tc.name] || (() => tc.name))(tc.input || {}));
          const r = runTool(tc.name, tc.input || {});
          results.push({ id: tc.id, name: tc.name, content: r.text, isError: !!r.error });
        }
        a.pushToolResults(messages, results);
      }
    } catch (e) {
      reportError(e);
    } finally {
      thinking.remove();
      running = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  /* ----- eventos de configuración de la key ----- */
  $("aiSaveKey").onclick = async () => {
    const v = $("aiKeyInput").value.trim();
    if (!adapter().validateKey(v)) { $("aiSetupMsg").textContent = "La clave no parece válida (debería empezar por «" + adapter().keyHint + "»)."; return; }
    localStorage.setItem(adapter().keyStore, v);
    $("aiKeyInput").value = "";
    hideSetup();
    await refreshModels(true);      // clave nueva: preguntar qué modelos acepta
    const esperando = addBubble("thinking", "Comprobando la clave…");
    const sirve = await probeKey();
    esperando.remove();
    if (sirve && messages.length === 0)
      addBubble("bot", "¡Listo! Soy tu asistente de LaTeX (" + escapeHtml(adapter().label.split(" — ")[0]) +
        "). Puedo leer y editar los archivos de este proyecto. Prueba: <em>«resume la introducción»</em> o <em>«arregla los errores de compilación»</em>.");
  };
  $("aiClearKey").onclick = () => { localStorage.removeItem(adapter().keyStore); showSetup("Clave borrada de este navegador."); };
  $("aiSettings").onclick = () => showSetup("");

  sendBtn.onclick = send;
  input.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  input.oninput = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; };

  /* ----- API pública ----- */
  const splitAi = $("splitAi");
  function open() {
    panel.style.display = "flex";
    if (splitAi) splitAi.style.display = "";
    if (hasKey()) { hideSetup(); input.focus(); } else showSetup("");
  }
  function close() {
    panel.style.display = "none";
    if (splitAi) splitAi.style.display = "none";
  }
  function toggle() { (panel.style.display === "none" || !panel.style.display) ? open() : close(); }
  function reset() { messages = []; msgBox.innerHTML = ""; if (hasKey()) hideSetup(); }

  $("aiClose").onclick = close;
  renderSetup();

  return { toggle, open, close, reset, isOpen: () => panel.style.display === "flex" };
}
