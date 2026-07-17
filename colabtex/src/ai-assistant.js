"use strict";
/* ============================================================
   ColabTeX — Asistente IA (BYOK: la clave del usuario, en su
   navegador). Llama a la API de Anthropic directamente desde
   el navegador (header anthropic-dangerous-direct-browser-access)
   y edita los archivos del proyecto vía herramientas (tool use)
   que operan sobre el documento Yjs → los cambios son
   colaborativos y en vivo.
   ============================================================ */
import { escapeHtml } from "./util.js";

const $ = id => document.getElementById(id);

const KEY_STORE = "colabtex_anthropic_key";
const MODEL_STORE = "colabtex_ai_model";
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MAX_TOKENS = 4096;
const MAX_TURNS = 16;          // tope de iteraciones de tool use por mensaje

const MODELS = {
  "claude-sonnet-5": "Sonnet 5 (rápido y económico)",
  "claude-opus-4-8": "Opus 4.8 (más capaz)"
};
const DEFAULT_MODEL = "claude-sonnet-5";

/* ---------- herramientas expuestas al modelo ---------- */
function toolDefs(readOnly) {
  const tools = [
    {
      name: "list_files",
      description: "Lista todos los archivos del proyecto (archivos de texto/LaTeX editables y recursos binarios como imágenes o PDF).",
      input_schema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "read_file",
      description: "Lee el contenido completo de un archivo de texto/LaTeX del proyecto (por ejemplo main.tex).",
      input_schema: {
        type: "object",
        properties: { path: { type: "string", description: "Ruta del archivo, p. ej. 'main.tex' o 'secciones/intro.tex'." } },
        required: ["path"]
      }
    },
    {
      name: "get_compile_log",
      description: "Devuelve el resultado de la última compilación (errores y advertencias de pdfTeX), útil para diagnosticar por qué no compila.",
      input_schema: { type: "object", properties: {}, required: [] }
    }
  ];
  if (readOnly) return tools;
  tools.push(
    {
      name: "str_replace",
      description: "Reemplaza una única aparición exacta de 'old_str' por 'new_str' dentro de un archivo. Úsalo para ediciones puntuales. El texto 'old_str' debe aparecer exactamente una vez.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_str: { type: "string", description: "Texto exacto a reemplazar (con suficiente contexto para que sea único)." },
          new_str: { type: "string", description: "Texto nuevo." }
        },
        required: ["path", "old_str", "new_str"]
      }
    },
    {
      name: "write_file",
      description: "Crea un archivo nuevo o reescribe por completo uno existente con el contenido dado. Para cambios pequeños prefiere str_replace.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" }
        },
        required: ["path", "content"]
      }
    },
    {
      name: "create_folder",
      description: "Crea una carpeta vacía en el proyecto (p. ej. 'figuras' o 'capitulos/anexos').",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"]
      }
    }
  );
  return tools;
}

/* etiqueta corta para la burbuja de acción */
const TOOL_LABEL = {
  list_files: () => "📁 listó los archivos",
  read_file: i => "📖 leyó " + (i.path || "?"),
  get_compile_log: () => "📋 revisó el registro de compilación",
  str_replace: i => "✎ editó " + (i.path || "?"),
  write_file: i => "✚ escribió " + (i.path || "?"),
  create_folder: i => "📂 creó la carpeta " + (i.path || "?")
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
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/\n/g, "<br>");
      out += t;
    }
  }
  return out;
}

export function createAssistant(api) {
  let model = localStorage.getItem(MODEL_STORE) || DEFAULT_MODEL;
  if (!MODELS[model]) model = DEFAULT_MODEL;
  let messages = [];     // historial para la API
  let running = false;

  /* ----- referencias DOM ----- */
  const panel = $("aiPanel");
  const setup = $("aiSetup");
  const msgBox = $("aiMessages");
  const input = $("aiInput");
  const sendBtn = $("aiSend");
  const modelSel = $("aiModel");

  /* poblar selector de modelo */
  modelSel.innerHTML = "";
  for (const [id, label] of Object.entries(MODELS)) {
    const o = document.createElement("option");
    o.value = id; o.textContent = label;
    modelSel.appendChild(o);
  }
  modelSel.value = model;
  modelSel.onchange = () => { model = modelSel.value; localStorage.setItem(MODEL_STORE, model); };

  const hasKey = () => !!localStorage.getItem(KEY_STORE);

  function showSetup(msg) {
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
  function addError(text) {
    addBubble("error", escapeHtml(text));
  }

  /* ----- ejecución de herramientas ----- */
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

  /* ----- llamada a la API ----- */
  async function callApi() {
    const key = localStorage.getItem(KEY_STORE);
    const readOnly = api.isReadOnly();
    const files = api.listFiles();
    const system =
      "Eres un asistente experto en LaTeX integrado en ColabTeX, un editor colaborativo " +
      "que compila con pdfTeX en el navegador. Ayudas a la persona a redactar y corregir su documento.\n" +
      "- Puedes leer y editar los archivos del proyecto con las herramientas disponibles.\n" +
      "- Haz cambios mínimos y precisos: usa str_replace para ediciones puntuales y write_file " +
      "solo para archivos nuevos o reescrituras completas.\n" +
      "- Si no conoces el contenido de un archivo antes de editarlo, léelo primero.\n" +
      "- Recuerda que el documento se compila con pdfTeX (no XeLaTeX/LuaLaTeX): evita paquetes incompatibles como fontspec.\n" +
      "- Explica brevemente lo que haces y responde en el idioma de la persona (español por defecto).\n" +
      (readOnly ? "- IMPORTANTE: el proyecto está en modo SOLO LECTURA; no puedes editar, solo sugerir.\n" : "") +
      "\nArchivo principal de compilación: " + api.getMainFile() +
      "\nArchivos de texto: " + (files.tex.join(", ") || "(ninguno)") +
      "\nRecursos: " + (files.assets.join(", ") || "(ninguno)");

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system,
        tools: toolDefs(readOnly),
        messages
      })
    });
    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = j.error && j.error.message ? j.error.message : JSON.stringify(j); }
      catch (e) { detail = await res.text().catch(() => ""); }
      const err = new Error(detail || ("HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    return res.json();
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
    messages.push({ role: "user", content: text });

    running = true;
    sendBtn.disabled = true;
    const thinking = addBubble("thinking", "Pensando…");

    try {
      let turns = 0;
      while (turns++ < MAX_TURNS) {
        const data = await callApi();
        // volcar texto y detectar tool_use
        const toolUses = [];
        for (const block of data.content || []) {
          if (block.type === "text" && block.text.trim()) addBubble("bot", mdToHtml(block.text));
          else if (block.type === "tool_use") toolUses.push(block);
        }
        messages.push({ role: "assistant", content: data.content });

        if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

        const results = [];
        for (const tu of toolUses) {
          const label = (TOOL_LABEL[tu.name] || (() => tu.name))(tu.input || {});
          addChip(label);
          const r = runTool(tu.name, tu.input || {});
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: r.text,
            ...(r.error ? { is_error: true } : {})
          });
        }
        messages.push({ role: "user", content: results });
        // continúa el bucle: el modelo reacciona a los resultados
      }
    } catch (e) {
      if (e.status === 401) {
        addError("Tu API key no es válida o expiró. Vuelve a configurarla con el botón ⚙.");
      } else if (e.status === 429) {
        addError("Límite de uso alcanzado en tu cuenta de Anthropic (429). Intenta más tarde.");
      } else if (e.status === 400) {
        addError("La API rechazó la solicitud (400): " + e.message);
      } else {
        addError("No se pudo contactar a Claude: " + (e.message || String(e)) +
          "\nSi es un error de red/CORS, revisa que tu API key sea correcta y que tengas conexión.");
      }
    } finally {
      thinking.remove();
      running = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  /* ----- eventos de configuración de la key ----- */
  $("aiSaveKey").onclick = () => {
    const v = $("aiKeyInput").value.trim();
    if (!v.startsWith("sk-ant-")) { $("aiSetupMsg").textContent = "La clave debe empezar por «sk-ant-…»."; return; }
    localStorage.setItem(KEY_STORE, v);
    $("aiKeyInput").value = "";
    hideSetup();
    if (messages.length === 0)
      addBubble("bot", "¡Listo! Soy tu asistente de LaTeX. Puedo leer y editar los archivos de este proyecto. " +
        "Prueba con: <em>«resume la sección de introducción»</em> o <em>«arregla los errores de compilación»</em>.");
  };
  $("aiClearKey").onclick = () => {
    localStorage.removeItem(KEY_STORE);
    showSetup("Clave borrada de este navegador.");
  };
  $("aiSettings").onclick = () => showSetup("");

  sendBtn.onclick = send;
  input.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };
  input.oninput = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; };

  /* ----- API pública ----- */
  function open() {
    panel.style.display = "flex";
    if (hasKey()) { hideSetup(); input.focus(); }
    else showSetup("");
  }
  function close() { panel.style.display = "none"; }
  function toggle() { (panel.style.display === "none" || !panel.style.display) ? open() : close(); }
  function reset() {
    messages = [];
    msgBox.innerHTML = "";
    if (hasKey()) hideSetup();
  }

  $("aiClose").onclick = close;

  return { toggle, open, close, reset, isOpen: () => panel.style.display === "flex" };
}
