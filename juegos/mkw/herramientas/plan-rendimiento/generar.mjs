// Arma el plan de rendimiento en dos formatos desde UN solo archivo de datos (datos.mjs):
//   - el .md para leer en las sesiones siguientes (docs/plan-rendimiento.md del proyecto)
//   - la página HTML del artifact (con filtros y diagramas)
// Uso: node generar.mjs <salida.md> <salida.html>
import { writeFileSync } from 'node:fs';
import * as D from './datos.mjs';

const [salMd, salHtml] = process.argv.slice(2);

// ---------- marcas mínimas: **negrita**, `código` y saltos de párrafo ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const enLinea = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[\[([A-Z]\d+)\]\]/g, '<a href="#$1" class="ref-item">$1</a>');
const parrafosHtml = s => String(s).trim().split(/\n\s*\n/).map(p => {
  const lineas = p.split('\n');
  if (lineas.every(l => /^\s*- /.test(l))) return '<ul>' + lineas.map(l => `<li>${enLinea(l.replace(/^\s*- /, ''))}</li>`).join('') + '</ul>';
  return `<p>${enLinea(p.replace(/\n/g, ' '))}</p>`;
}).join('\n');
const mdLinea = s => String(s).replace(/\[\[([A-Z]\d+)\]\]/g, '$1');

const PRIO = { urgente: 'Urgente', alta: 'Alta', media: 'Media', investigar: 'Investigar' };
const APARATO = { ambos: 'PC y celular', pc: 'PC', celular: 'Celular' };
const MODO = { ambos: 'Un jugador y sala', uno: 'Un jugador', sala: 'Sala' };
const FUENTE = { medido: 'Medido', codigo: 'Leído en el código', sospecha: 'Sospecha', dato: 'Dato de la plataforma' };
const BANDERA = { r2: 'Volver a subir R2', decompilar: 'Decompilar', recompilar: 'Recompilar el .wasm', dueno: 'Lo hace el dueño', medir: 'Medir primero' };
const VEREDICTO = { mantener: 'Mantener', mejorar: 'Mejorar', cambiar: 'Cambiar', probar: 'Probar', no: 'No', despues: 'Después' };

const todos = D.areas.flatMap(a => a.items);
const porId = Object.fromEntries(todos.map(i => [i.id, i]));
for (const f of D.fases) for (const id of f.items) if (!porId[id]) throw new Error(`la fase ${f.n} cita ${id}, que no existe`);
const ids = new Set(); for (const i of todos) { if (ids.has(i.id)) throw new Error('id repetido ' + i.id); ids.add(i.id); }
const enFase = new Set(D.fases.flatMap(f => f.items));
for (const i of todos) if (!enFase.has(i.id)) console.warn(`aviso: ${i.id} no está en ninguna fase`);
for (const i of todos) for (const m of `${i.pasa} ${i.arreglo} ${i.comprueba || ''}`.matchAll(/\[\[([A-Z]\d+)\]\]/g)) if (!porId[m[1]]) throw new Error(`${i.id} cita ${m[1]}, que no existe`);
// Y en todo lo demás (respuestas, «¿Alcanza?», fases, decisiones, tablas): ninguna cita a un ítem que no existe.
for (const m of JSON.stringify(D).matchAll(/\[\[([A-Z]\d+)\]\]/g)) if (!porId[m[1]]) throw new Error(`se cita ${m[1]}, que no existe`);

// ---------- orden de trabajo y avance: cada ítem en un solo paso, y el avance solo con claves que existen ----------
const enPaso = {};
for (const p of D.orden) for (const id of p.items) {
  if (!porId[id]) throw new Error(`el paso ${p.n} cita ${id}, que no existe`);
  if (enPaso[id]) throw new Error(`${id} está en los pasos ${enPaso[id]} y ${p.n}`);
  enPaso[id] = p.n;
}
for (const i of todos) if (!enPaso[i.id]) throw new Error(`${i.id} no está en ningún paso del orden de trabajo`);
const ESTADOS = { hecho: 'hecho', 'en curso': 'en curso', descartado: 'descartado' };
const claveCriterio = (p, k) => `paso${p.n}.${k + 1}`;
const criterios = new Set(D.orden.flatMap(p => p.listo.map((_, k) => claveCriterio(p, k))));
for (const [clave, v] of Object.entries(D.avance)) {
  if (!porId[clave] && !criterios.has(clave)) throw new Error(`avance.mjs marca ${clave}, que no es ni ítem ni criterio`);
  if (!Array.isArray(v) || !ESTADOS[v[0]]) throw new Error(`avance.mjs: ${clave} tiene un estado que no existe (hecho, en curso, descartado)`);
}
const estadoDe = clave => D.avance[clave]?.[0] || 'pendiente';
const cerrado = clave => ['hecho', 'descartado'].includes(estadoDe(clave));
// Versión 4: los pasos viejos (versiones 1–3) quedan como historia («historia: true»): se ven en «Lo ya hecho» y en el
// avance, pero no cuentan en el calendario. Los pasos vivos son las etapas de la versión 4.
const vivos = D.orden.filter(p => !p.historia), historia = D.orden.filter(p => p.historia);
const pasoCerrado = p => p.items.every(cerrado) && p.listo.every((_, k) => cerrado(claveCriterio(p, k)));
// El calendario de trabajo: cada paso empieza cuando termina el anterior (o junto con el paso que dice «paralelo»),
// en semanas [mínimo, máximo]; un paso en paralelo que termina tarde atrasa al siguiente que no es paralelo.
const tramo = {};
{
  let fin = [0, 0], finParalelos = [0, 0];
  for (const p of vivos) {
    const ini = p.paralelo ? tramo[p.paralelo].ini : [Math.max(fin[0], finParalelos[0]), Math.max(fin[1], finParalelos[1])];
    const f = [ini[0] + p.semanas[0], ini[1] + p.semanas[1]];
    tramo[p.n] = { ini, fin: f };
    if (p.paralelo) finParalelos = [Math.max(finParalelos[0], f[0]), Math.max(finParalelos[1], f[1])];
    else fin = f;
  }
}
const finTotal = [Math.max(...vivos.map(p => tramo[p.n].fin[0])), Math.max(...vivos.map(p => tramo[p.n].fin[1]))];
const enFila = [vivos.reduce((s, p) => s + p.semanas[0], 0), vivos.reduce((s, p) => s + p.semanas[1], 0)];
const rango = ([a, b]) => { const x = Math.round(a), y = Math.round(b); return x === y ? `${x}` : `${x}–${y}`; };
const meses = ([a, b]) => rango([a / 4.35, b / 4.35]);
const itemsHechos = todos.filter(i => estadoDe(i.id) === 'hecho').length;
const itemsCerrados = todos.filter(i => cerrado(i.id)).length;
const pasosCerrados = vivos.filter(pasoCerrado).length;
const viejosCerrados = historia.filter(pasoCerrado).length;
const estado = D.meta.estado.replace('nada empezado', itemsCerrados ? `${itemsHechos} de ${todos.length} ítems hechos` : 'nada empezado');
const paralelos = vivos.filter(p => p.paralelo);
const textoParalelos = paralelos.map(p => `${p.nombre.split(' — ')[0].toLowerCase()} en paralelo con la ${vivos.find(q => q.n === p.paralelo).nombre.split(' — ')[0].toLowerCase()}`).join('; ');
const totalTexto = `En total, unas **${rango(finTotal)} semanas de trabajo** (≈ ${meses(finTotal)} meses)${textoParalelos ? `, con la ${textoParalelos}` : ''}; ${rango(enFila)} (≈ ${meses(enFila)} meses) si todo va en fila. La etapa 4 va solo si los pilotos de la etapa 0 pasan: sin ella, el total baja a lo que suman las demás.`;

// =====================================================================================
// .md (para Claude: completo, con referencias al código)
// =====================================================================================
function md() {
  const o = [];
  o.push(`# ${D.meta.titulo}`, '', `> ${D.meta.subtitulo}`, '', `**Fecha:** ${D.meta.fecha} · **Estado:** ${estado}${D.meta.pagina ? ` · **Página (artifact):** ${D.meta.pagina}` : ''}`, '');
  o.push('## Cómo leer este archivo (para Claude)', '', D.meta.paraClaude.trim(), '');
  o.push('## Lo que pidió el dueño', '', ...D.pedido.map(p => `- ${p}`), '');
  const A = D.alcanza;
  o.push('## ¿Alcanza? La respuesta honesta', '', `**${A.veredicto}.**`, '', mdLinea(A.texto.trim()), '');
  o.push(`| Objetivo | ${A.columnas.lista} | ${A.columnas.profundo} | Lo que ningún plan arregla |`, '|---|---|---|---|', ...A.objetivos.map(x => `| ${x.objetivo} | ${mdLinea(x.lista)} | ${mdLinea(x.profundo)} | ${mdLinea(x.limite)} |`), '');
  o.push('### La escalera de aparatos', '', mdLinea(A.escaleraIntro.trim()), '');
  o.push(`| Aparato | Ejemplos | ${A.columnas.nucleo} | ${A.columnas.hoy} | ${A.columnas.escLista} | ${A.columnas.escFondo} | ¿60 en el navegador? |`, '|---|---|---|---|---|---|---|', ...A.escalera.map(x => `| ${x.aparato} | ${x.ejemplos} | ${x.nucleo} | ${x.hoy} | ${x.lista} | ${x.fondo} | ${mdLinea(x.veredicto)} |`), '');
  o.push(mdLinea(A.escaleraPie), '');
  // El presupuesto por pieza y el cuadro repartido en núcleos, en texto.
  o.push(`### ${A.presupuestoTitulo}`, '', mdLinea(A.presupuestoIntro.trim()), '');
  o.push(`| Pieza | Dónde corre | ${A.columnas.pHoy} | ${A.columnas.pMeta} | ${A.columnas.pMedia} | Con qué |`, '|---|---|---|---|---|---|', ...A.presupuesto.map(x => `| ${x.pieza} | ${x.donde} | ${x.hoy} | ${x.meta} | ${x.media} | ${mdLinea(x.como)} |`), '');
  o.push('Un cuadro repartido en núcleos, meta para la gama media: ' + A.hilos.meta.map(f => `${f.nombre} (${f.partes.map(p => `${p[0]}, ${String(p[1]).replace('.', ',')} ms`).join('; ')})`).join('; ') + '.', '', mdLinea(A.hilosPie), '');
  o.push(mdLinea(A.techo.trim()), '');
  o.push('### Qué cambia en el plan', '', mdLinea(A.cambios.trim()), '');
  o.push('## Respuesta corta', '');
  for (const r of D.respuesta) o.push(`### ${r.pregunta}`, '', `**${r.veredicto}.** ${mdLinea(r.texto.trim())}`, '');
  o.push('## Dónde se van los 16,7 ms (lo medido)', '', mdLinea(D.cuadro.texto.trim()), '');
  o.push('| Caso | ms por cuadro | Fuente |', '|---|---|---|', ...D.cuadro.filas.map(f => `| ${f.caso} | ${f.ms} | ${f.fuente} |`), '');
  o.push('Reparto en PC (§85):', '', '| Parte | Fuera de la sala | Sala |', '|---|---|---|', ...D.cuadro.reparto.map(f => `| ${f[0]} | ${f[1]} | ${f[2]} |`), '');
  o.push('## ¿Multijugador asíncrono?', '', mdLinea(D.asincronia.texto.trim()), '');
  o.push('| Opción | Qué es | Veredicto | Esfuerzo |', '|---|---|---|---|', ...D.asincronia.opciones.map(x => `| ${x.nombre} | ${x.que} | **${x.veredicto}** — ${mdLinea(x.porque)} | ${x.esfuerzo} |`), '');
  o.push(mdLinea(D.asincronia.cierre.trim()), '');
  o.push('## Cuestionar todo: capa por capa', '', mdLinea(D.cuestionarIntro.trim()), '');
  o.push('| Capa | Hoy | Veredicto | Por qué | Costo |', '|---|---|---|---|---|', ...D.cuestionar.map(c => `| ${c.capa} | ${c.hoy} | **${VEREDICTO[c.veredicto]}** | ${mdLinea(c.porque)} | ${c.costo} |`), '');
  o.push('## La lista', '', 'Prioridad: Urgente = causa el lag o las trabas de hoy; Alta = necesaria para 60 fps estables; Media = mejora o seguridad; Investigar = solo si lo anterior no alcanza.', '');
  for (const a of D.areas) {
    o.push(`### ${a.id} · ${a.nombre}`, '', mdLinea(a.intro.trim()), '');
    for (const i of a.items) {
      const meta = [PRIO[i.prio], APARATO[i.aparato], MODO[i.modo], i.esfuerzo, FUENTE[i.fuente], ...(i.banderas || []).map(b => BANDERA[b])].filter(Boolean).join(' · ');
      o.push(`#### ${i.id}. ${i.titulo}`, '', `*${meta}*`, '');
      o.push(`- **Qué pasa:** ${mdLinea(i.pasa.trim())}`);
      o.push(`- **Arreglo:** ${mdLinea(i.arreglo.trim())}`);
      if (i.gana) o.push(`- **Gana:** ${mdLinea(i.gana)}`);
      if (i.comprueba) o.push(`- **Se comprueba:** ${mdLinea(i.comprueba.trim())}`);
      if (i.refs) o.push(`- **Dónde:** ${i.refs}`);
      if (i.nota) o.push(`- **Nota:** ${mdLinea(i.nota.trim())}`);   // (lo medido después, p. ej. el Oppo del 30-10)
      o.push('');
    }
  }
  o.push('## Paso a paso', '', mdLinea(D.fasesIntro.trim()), '');
  for (const f of D.fases) {
    o.push(`### Fase ${f.n}. ${f.nombre} (${f.duracion})`, '', mdLinea(f.objetivo.trim()), '');
    o.push(`**Ítems:** ${f.items.join(', ')}`, '');
    o.push('**Pasos:**', '', ...f.pasos.map((p, k) => `${k + 1}. ${mdLinea(p)}`), '');
    o.push('**Listo cuando:**', '', ...f.listo.map(p => `- ${mdLinea(p)}`), '');
    if (f.dueno?.length) o.push('**Lo que hace el dueño:**', '', ...f.dueno.map(p => `- ${mdLinea(p)}`), '');
  }
  o.push('## Reglas que no cambian', '', ...D.reglas.map(r => `- ${mdLinea(r)}`), '');
  o.push('## Decisiones que quedan para el dueño', '', ...D.decisiones.map(r => `- ${mdLinea(r)}`), '');
  o.push('## Glosario corto', '', ...D.glosario.map(g => `- **${g[0]}:** ${mdLinea(g[1])}`), '');
  o.push('## De dónde sale esto', '', mdLinea(D.fuentes.trim()), '');
  // Al final, como pidió el dueño: el orden de trabajo con lo que tarda, y las casillas del avance.
  o.push('## Orden de trabajo y cuánto tarda', '', mdLinea(D.ordenIntro.trim()), '');
  o.push('| Paso | Qué | Fase | Ítems | Dura | Termina hacia la semana | Lo que haces tú |', '|---|---|---|---|---|---|---|',
    ...vivos.map(p => `| ${p.n} | **${p.nombre}.** ${mdLinea(p.que)} | ${p.fase} | ${p.items.join(', ')} | ${p.duracion} | ${rango(tramo[p.n].fin)} | ${p.dueno ? mdLinea(p.dueno) : '—'} |`), '');
  o.push(mdLinea(totalTexto), '');
  o.push('### Lo ya hecho (versiones 1–3)', '', mdLinea(D.historiaIntro.trim()), '');
  o.push('| Paso viejo | Qué | Ítems que quedaron aquí (hechos o descartados) | Duró (estimado entonces) |', '|---|---|---|---|',
    ...historia.map(p => `| ${p.n} | **${p.nombre}.** ${mdLinea(p.que)} | ${p.items.join(', ')} | ${p.duracion} |`), '');
  o.push('## Avance', '', mdLinea(D.avanceIntro.trim()), '', `**${itemsCerrados} de ${todos.length} ítems cerrados** (${Math.round(itemsCerrados / todos.length * 100)} %): ${itemsHechos} hechos y ${itemsCerrados - itemsHechos} descartados · **${pasosCerrados} de ${vivos.length} etapas de la versión 4 cerradas** · ${viejosCerrados} de ${historia.length} pasos viejos cerrados.`, '');
  const casillaMd = (clave, texto) => {
    const [e, fecha, nota] = D.avance[clave] || [];
    const marca = e === 'hecho' || e === 'descartado' ? 'x' : ' ';
    const cuerpo = e === 'descartado' ? `~~${texto}~~` : texto;
    return `- [${marca}] ${cuerpo}${e ? ` — ${e}${fecha ? ` ${fecha}` : ''}${nota ? ` · ${mdLinea(nota)}` : ''}` : ''}`;
  };
  const pasoMd = (p, nivel) => {
    const n = p.items.filter(cerrado).length;
    o.push(`${nivel} Paso ${p.n}. ${p.nombre} (${n}/${p.items.length})`, '');
    o.push(...p.items.map(id => casillaMd(id, `**${id}** · ${porId[id].titulo.replace(/\[\[([A-Z]\d+)\]\]/g, '$1')}`)));
    o.push(...p.listo.map((c, k) => casillaMd(claveCriterio(p, k), `Listo cuando: ${mdLinea(c)}`)), '');
  };
  for (const p of vivos) pasoMd(p, '###');
  o.push('### Lo ya hecho (versiones 1–3)', '');
  for (const p of historia) pasoMd(p, '####');
  return o.join('\n') + '\n';
}

// =====================================================================================
// HTML (para el dueño: lo mismo, con filtros y diagramas)
// =====================================================================================
function chip(clase, texto) { return `<span class="chip ${clase}">${esc(texto)}</span>`; }

function diagramaCuadro() {
  // Barras a escala: 0–50 ms en 540 px de ancho útil (x0 = 200). Una línea a 16,7 ms (60 fps) y otra a 33,3 (30 fps).
  const x0 = 200, ancho = 540, max = 50, fila = 34, alto = 40 + D.cuadro.barras.length * fila + 34;
  const X = ms => x0 + Math.min(ms, max) / max * ancho;
  const lineas = [];
  for (const t of [0, 10, 16.7, 25, 33.3, 40, 50]) {
    const x = X(t).toFixed(1), clave = t === 16.7 || t === 33.3;
    lineas.push(`<line x1="${x}" x2="${x}" y1="26" y2="${alto - 26}" class="${clave ? 'eje-clave' : 'eje'}"/>`);
    lineas.push(`<text x="${x}" y="${alto - 10}" class="tick" text-anchor="middle">${String(t).replace('.', ',')}</text>`);
  }
  lineas.push(`<text x="${X(16.7) + 4}" y="20" class="nota-clave">60 fps</text>`);
  lineas.push(`<text x="${X(33.3) + 4}" y="20" class="nota-clave">30 fps</text>`);
  D.cuadro.barras.forEach((b, k) => {
    const y = 34 + k * fila, h = 18, cls = b.estimado ? 'barra-est' : (b.desde > 16.7 ? 'barra-mal' : (b.hasta > 16.7 ? 'barra-borde' : 'barra-bien'));
    lineas.push(`<text x="${x0 - 10}" y="${y + 13}" class="rotulo" text-anchor="end">${esc(b.caso)}</text>`);
    lineas.push(`<rect x="${x0}" y="${y}" width="${(X(b.desde) - x0).toFixed(1)}" height="${h}" rx="3" class="${cls}"/>`);
    if (b.hasta > b.desde) {
      lineas.push(`<line x1="${X(b.desde).toFixed(1)}" x2="${X(b.hasta).toFixed(1)}" y1="${y + h / 2}" y2="${y + h / 2}" class="bigote"/>`);
      lineas.push(`<line x1="${X(b.hasta).toFixed(1)}" x2="${X(b.hasta).toFixed(1)}" y1="${y + 4}" y2="${y + h - 4}" class="bigote"/>`);
    }
    const etiqueta = b.hasta > max ? `${b.texto} →` : b.texto;
    const xt = Math.min(X(b.hasta) + 6, x0 + ancho - 4);
    lineas.push(`<text x="${xt.toFixed(1)}" y="${y + 13}" class="valor"${X(b.hasta) + 6 > x0 + ancho - 60 ? ' text-anchor="end"' : ''}>${esc(etiqueta)}</text>`);
  });
  return `<figure class="diagrama"><div class="desliza"><svg viewBox="0 0 820 ${alto}" role="img" aria-label="Milisegundos por cuadro en cada caso medido, con las líneas de 60 y 30 fps">${lineas.join('')}</svg></div>
<figcaption>${enLinea(D.cuadro.pie)}</figcaption></figure>`;
}

function diagramaEscalera() {
  // Dos barras por escalón, a escala 0–80 ms: hoy (gris) y con todo el plan (color según si entra en 16,7 ms).
  // Lo que pasa de 80 ms termina en flecha con el número al costado. Barra llena = medido; punteada = estimado.
  const filas = D.alcanza.escalera, x0 = 210, ancho = 540, max = 80, fila = 46, alto = 34 + filas.length * fila + 26;
  const X = ms => x0 + Math.min(ms, max) / max * ancho;
  const o = [];
  for (const t of [0, 16.7, 33.3, 50, 66.7, 80]) {
    const x = X(t).toFixed(1), clave = t === 16.7 || t === 33.3;
    o.push(`<line x1="${x}" x2="${x}" y1="26" y2="${alto - 22}" class="${clave ? 'eje-clave' : 'eje'}"/>`);
    o.push(`<text x="${x}" y="${alto - 8}" class="tick" text-anchor="middle">${String(t).replace('.', ',')}</text>`);
  }
  o.push(`<text x="${X(16.7) + 4}" y="20" class="nota-clave">60 fps</text>`, `<text x="${X(33.3) + 4}" y="20" class="nota-clave">30 fps</text>`);
  const ajuste = ([a, b]) => b <= 16.7 ? 'est-bien' : (a <= 16.7 ? 'est-borde' : 'est-mal');
  const barra = (y, [a, b], cls) => {
    o.push(`<rect x="${x0}" y="${y}" width="${(X(a) - x0).toFixed(1)}" height="13" rx="2" class="${cls}"/>`);
    if (b > a) o.push(`<line x1="${X(a).toFixed(1)}" x2="${X(b).toFixed(1)}" y1="${y + 6.5}" y2="${y + 6.5}" class="bigote"/>`, b > max
      ? `<path d="M${X(max) - 7} ${y + 1.5} L${X(max)} ${y + 6.5} L${X(max) - 7} ${y + 11.5}" class="bigote" fill="none"/>`
      : `<line x1="${X(b).toFixed(1)}" x2="${X(b).toFixed(1)}" y1="${y + 2}" y2="${y + 11}" class="bigote"/>`);
    const texto = `${String(a).replace('.', ',')}–${String(b).replace('.', ',')}`;
    o.push(`<text x="${(Math.min(X(b), X(max)) + 6).toFixed(1)}" y="${y + 11}" class="valor">${texto}</text>`);
  };
  filas.forEach((f, k) => {
    const y = 34 + k * fila;
    o.push(`<text x="${x0 - 10}" y="${y + 19}" class="rotulo" text-anchor="end">${esc(f.aparato)}</text>`);
    barra(y, f.b.hoy, f.b.medido ? 'barra-hoy' : 'barra-hoy-est');
    barra(y + 17, f.b.fondo, ajuste(f.b.fondo));
  });
  return `<figure class="diagrama"><div class="desliza"><svg viewBox="0 0 860 ${alto}" role="img" aria-label="Milisegundos de CPU por cuadro en cada escalón de aparatos, hoy y con la versión 4 (estimado), con las líneas de 60 y 30 fps">${o.join('')}</svg></div>
<figcaption>${enLinea(D.alcanza.escaleraPie)}</figcaption></figure>`;
}

function diagramaHilos() {
  // Un cuadro de un teléfono de gama media, a escala 0–50 ms: arriba hoy (todo en un núcleo, en fila), abajo la meta
  // de la versión 3 (cada pieza en su núcleo y en paralelo). Rayas: la meta con margen (12 ms), 60 fps y 30 fps.
  const H = D.alcanza.hilos, x0 = 250, ancho = 560, max = 50, fila = 30, h = 18;
  const X = ms => x0 + Math.min(ms, max) / max * ancho;
  const ms = v => String(v).replace('.', ',');
  const barras = [];
  let y = 40;
  const grupo = (titulo, lista, hoy) => {
    barras.push(`<text x="${x0 - 10}" y="${y + 4}" class="titulito" text-anchor="end">${esc(titulo)}</text>`);
    y += 14;
    for (const f of lista) {
      barras.push(`<text x="${x0 - 10}" y="${y + 13}" class="rotulo" text-anchor="end">${esc(f.nombre)}</text>`);
      let t = 0;
      f.partes.forEach(([nombre, dur], k) => {
        const xa = X(t), xb = X(t + dur), w = xb - xa;
        const cls = f.estimado ? 'est-mal' : (hoy ? 'seg-hoy' : 'est-bien');
        barras.push(`<rect x="${xa.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="2" class="${cls}"/>`);
        if (t + dur > max) barras.push(`<path d="M${X(max) - 7} ${y + 3} L${X(max)} ${y + h / 2} L${X(max) - 7} ${y + h - 3}" class="bigote" fill="none"/>`);
        const cabe = nombre.length * 6.1 + 12 < w;
        if (cabe) barras.push(`<text x="${(xa + 6).toFixed(1)}" y="${y + 13}" class="seg-txt">${esc(nombre)}</text>`);
        else barras.push(`<text x="${(xb + 6).toFixed(1)}" y="${y + 13}" class="seg-txt halo">${esc(nombre)} · ${ms(dur)} ms</text>`);
        t += dur;
      });
      if (t > max) barras.push(`<text x="${(X(max) - 12).toFixed(1)}" y="${y + 13}" class="valor" text-anchor="end">≥ ${ms(t)} ms</text>`);
      else if (f.partes.length > 1 || f.partes[0][0].length * 6.1 + 12 < X(t) - x0) barras.push(`<text x="${(X(t) + 6).toFixed(1)}" y="${y + 13}" class="valor halo">${ms(t)} ms</text>`);
      y += fila;
    }
    y += 10;
  };
  grupo(H.tituloHoy || 'Hoy (estimado)', H.hoy, true);
  grupo(H.tituloMeta || 'La meta', H.meta, false);
  const alto = y + 16, o = [];
  for (const t of [0, 10, 20, 30, 40, 50]) {
    o.push(`<line x1="${X(t)}" x2="${X(t)}" y1="26" y2="${alto - 22}" class="eje"/>`, `<text x="${X(t)}" y="${alto - 8}" class="tick" text-anchor="middle">${t}</text>`);
  }
  if (H.metaMs) o.push(`<line x1="${X(H.metaMs)}" x2="${X(H.metaMs)}" y1="26" y2="${alto - 22}" class="eje-meta"/>`, `<text x="${X(H.metaMs) - 4}" y="20" class="nota-meta" text-anchor="end">meta ${ms(H.metaMs)} ms</text>`);
  for (const [t, txt] of [[16.7, '60 fps'], [33.3, '30 fps']]) o.push(`<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="26" y2="${alto - 22}" class="eje-clave"/>`, `<text x="${(X(t) + 4).toFixed(1)}" y="20" class="nota-clave">${txt}</text>`);
  return `<figure class="diagrama"><div class="desliza"><svg viewBox="0 0 860 ${alto}" role="img" aria-label="${esc(H.aria || 'Un cuadro de un teléfono de gama media, hoy y con la meta')}">${o.join('')}${barras.join('')}</svg></div>
<figcaption>${enLinea(D.alcanza.hilosPie)}</figcaption></figure>`;
}

function diagramaOrden() {
  // El calendario de trabajo a escala: una fila por paso. Barra llena = lo que dura si todo sale en el mínimo;
  // el bigote llega hasta el máximo. En verde, los pasos cerrados; el paso en paralelo, con fondo claro.
  const x0 = 210, ancho = 590, fila = 24, alto = 44 + vivos.length * fila + 26;
  const max = Math.ceil(finTotal[1] / 4) * 4 + 4;
  const X = s => x0 + Math.min(s, max) / max * ancho;
  const o = [];
  for (let t = 0; t <= max; t += 4) o.push(`<line x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="34" y2="${alto - 22}" class="eje"/>`, `<text x="${X(t).toFixed(1)}" y="${alto - 8}" class="tick" text-anchor="middle">${t}</text>`);
  for (let m = 3; m * 4.35 < max; m += 3) o.push(`<line x1="${X(m * 4.35).toFixed(1)}" x2="${X(m * 4.35).toFixed(1)}" y1="26" y2="${alto - 22}" class="eje-clave"/>`, `<text x="${(X(m * 4.35) + 4).toFixed(1)}" y="20" class="nota-clave">${m} meses</text>`);
  o.push(`<text x="${x0 - 10}" y="${alto - 8}" class="tick" text-anchor="end">semanas de trabajo</text>`);
  vivos.forEach((p, k) => {
    const y = 40 + k * fila, { ini, fin } = tramo[p.n];
    const hecho = pasoCerrado(p);
    o.push(`<text x="${x0 - 10}" y="${y + 12}" class="rotulo" text-anchor="end">${p.n}. ${esc(p.corto)}</text>`);
    o.push(`<rect x="${X(ini[0]).toFixed(1)}" y="${y + 1}" width="${Math.max(2, X(fin[0]) - X(ini[0])).toFixed(1)}" height="14" rx="2" class="${hecho ? 'barra-hecha' : (p.paralelo ? 'barra-plan-par' : 'barra-plan')}"/>`);
    if (fin[1] > fin[0]) o.push(`<line x1="${X(fin[0]).toFixed(1)}" x2="${X(fin[1]).toFixed(1)}" y1="${y + 8}" y2="${y + 8}" class="bigote"/>`, `<line x1="${X(fin[1]).toFixed(1)}" x2="${X(fin[1]).toFixed(1)}" y1="${y + 3}" y2="${y + 13}" class="bigote"/>`);
    o.push(`<text x="${(X(fin[1]) + 6).toFixed(1)}" y="${y + 12}" class="valor">sem. ${rango(fin)}</text>`);
  });
  return `<figure class="diagrama"><div class="desliza"><svg viewBox="0 0 860 ${alto}" role="img" aria-label="Calendario de trabajo: las ${vivos.length} etapas de la versión 4 en semanas, de ${rango(finTotal)} semanas en total">${o.join('')}</svg></div>
<figcaption>Barra = lo que dura cada etapa si todo sale en el mínimo; el bigote llega hasta el máximo, y el número dice hacia qué semana termina.${paralelos.length ? ` Con fondo claro, lo que va en paralelo: la ${esc(textoParalelos)}.` : ''} Las etapas cerradas se pintan de verde. Los pasos viejos (versiones 1–3) no van en el calendario: están en «Lo ya hecho».</figcaption></figure>`;
}

function casillaHtml(clave, cuerpo) {
  const [e, fecha, nota] = D.avance[clave] || [];
  const clase = (e || 'pendiente').replace(' ', '-');
  const meta = e ? `<span class="ck-meta">${esc(e)}${fecha ? ` · ${esc(fecha)}` : ''}${nota ? ` · ${enLinea(nota)}` : ''}</span>` : '';
  return `<li class="ck ck-${clase}"><span class="caja" aria-hidden="true"></span><span class="ck-txt"><span class="sr">${esc(e || 'pendiente')}: </span>${cuerpo}${meta}</span></li>`;
}

function diagramaRed() {
  // Izquierda: malla donde cada consola espera a todas. Derecha: estrella con el árbitro al centro.
  const nodos = 6, r = 62, cx = 110, cy = 100, puntos = [...Array(nodos)].map((_, k) => [cx + r * Math.cos(k / nodos * 2 * Math.PI - Math.PI / 2), cy + r * Math.sin(k / nodos * 2 * Math.PI - Math.PI / 2)]);
  const malla = [];
  for (let a = 0; a < nodos; a++) for (let b = a + 1; b < nodos; b++) malla.push(`<line x1="${puntos[a][0].toFixed(1)}" y1="${puntos[a][1].toFixed(1)}" x2="${puntos[b][0].toFixed(1)}" y2="${puntos[b][1].toFixed(1)}" class="arista"/>`);
  const circ = (p, cls) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="11" class="${cls}"/>`;
  const izq = malla.join('') + puntos.map((p, k) => circ(p, k === 3 ? 'nodo-lento' : 'nodo')).join('') + `<text x="${puntos[3][0].toFixed(1)}" y="${(puntos[3][1] + 28).toFixed(1)}" class="rotulo" text-anchor="middle">el lento</text>`;
  const cx2 = 380, p2 = puntos.map(([x, y]) => [x - cx + cx2, y]);
  const der = p2.map(p => `<line x1="${cx2}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" class="arista-fuerte"/>`).join('') + p2.map((p, k) => circ(p, k === 3 ? 'nodo-lento' : 'nodo')).join('') + `<circle cx="${cx2}" cy="${cy}" r="23" class="nodo-arbitro"/><text x="${cx2}" y="${cy + 4}" class="rotulo-arb" text-anchor="middle">árbitro</text>`;
  return `<figure class="diagrama diagrama-red"><div class="desliza"><svg viewBox="0 0 500 200" role="img" aria-label="A la izquierda una malla donde cada consola espera a todas; a la derecha una estrella donde todas esperan solo al árbitro">
<text x="110" y="16" class="titulito" text-anchor="middle">Hoy: cada cuadro espera a todos</text>${izq}
<text x="380" y="16" class="titulito" text-anchor="middle">Árbitro: todos esperan a uno</text>${der}</svg></div>
<figcaption>${enLinea(D.asincronia.pie)}</figcaption></figure>`;
}

function item(i) {
  const banderas = (i.banderas || []).map(b => chip('bandera', BANDERA[b])).join('');
  return `<article class="item" id="${i.id}" data-prio="${i.prio}" data-aparato="${i.aparato}" data-modo="${i.modo}" data-banderas="${(i.banderas || []).join(' ')}">
<div class="item-id"><span>${i.id}</span></div>
<div class="item-cuerpo">
<h4>${enLinea(i.titulo)}</h4>
<div class="chips">${chip('prio prio-' + i.prio, PRIO[i.prio])}${chip('neutro', APARATO[i.aparato])}${chip('neutro', MODO[i.modo])}${chip('neutro', i.esfuerzo)}${chip('fuente', FUENTE[i.fuente])}${banderas}</div>
<div class="campo"><span class="lbl">Qué pasa</span>${parrafosHtml(i.pasa)}</div>
<div class="campo"><span class="lbl">Arreglo</span>${parrafosHtml(i.arreglo)}</div>
${i.gana ? `<div class="campo"><span class="lbl">Gana</span><p>${enLinea(i.gana)}</p></div>` : ''}
${i.comprueba ? `<div class="campo"><span class="lbl">Se comprueba</span>${parrafosHtml(i.comprueba)}</div>` : ''}
${i.refs ? `<p class="refs"><span class="lbl">Dónde</span><code>${esc(i.refs)}</code></p>` : ''}
${i.nota ? `<div class="campo"><span class="lbl">Nota</span>${parrafosHtml(i.nota)}</div>` : ''}
</div></article>`;
}

function html() {
  const conteo = p => todos.filter(i => i.prio === p).length;
  const respuesta = D.respuesta.map(r => `<div class="resp"><h3>${enLinea(r.pregunta)}</h3><p class="veredicto v-${r.tono}">${enLinea(r.veredicto)}</p>${parrafosHtml(r.texto)}</div>`).join('');
  const cuestionar = D.cuestionar.map(c => `<tr><th scope="row">${enLinea(c.capa)}</th><td>${enLinea(c.hoy)}</td><td>${chip('ver ver-' + c.veredicto, VEREDICTO[c.veredicto])}</td><td>${enLinea(c.porque)}</td><td class="costo">${enLinea(c.costo)}</td></tr>`).join('');
  const opciones = D.asincronia.opciones.map(x => `<tr class="op-${x.tono}"><th scope="row">${enLinea(x.nombre)}</th><td>${enLinea(x.que)}</td><td><strong>${enLinea(x.veredicto)}</strong> ${enLinea(x.porque)}</td><td class="costo">${enLinea(x.esfuerzo)}</td></tr>`).join('');
  const areas = D.areas.map(a => `<section class="area" id="area-${a.id}"><h3><span class="area-id">${a.id}</span>${enLinea(a.nombre)}</h3>${parrafosHtml(a.intro)}<div class="items">${a.items.map(item).join('\n')}</div></section>`).join('\n');
  const fases = D.fases.map(f => `<li class="fase"><div class="fase-cab"><span class="fase-n">${f.n}</span><div><h3>${enLinea(f.nombre)}</h3><p class="fase-dur">${enLinea(f.duracion)}</p></div></div>
${parrafosHtml(f.objetivo)}
<p class="fase-items"><span class="lbl">Ítems</span>${f.items.map(id => `<a href="#${id}" class="ref-item" title="${esc(porId[id].titulo.replace(/\*\*|`/g, ''))}">${id}</a>`).join(' ')}</p>
<div class="fase-cols"><div><span class="lbl">Pasos</span><ol>${f.pasos.map(p => `<li>${enLinea(p)}</li>`).join('')}</ol></div>
<div><span class="lbl">Listo cuando</span><ul class="listo">${f.listo.map(p => `<li>${enLinea(p)}</li>`).join('')}</ul>${f.dueno?.length ? `<span class="lbl">Lo que haces tú</span><ul>${f.dueno.map(p => `<li>${enLinea(p)}</li>`).join('')}</ul>` : ''}</div></div></li>`).join('\n');
  const ficha = D.ficha.map(f => `<div class="dato"><span class="dato-v">${enLinea(f[0])}</span><span class="dato-l">${enLinea(f[1])}</span></div>`).join('');
  const A = D.alcanza;
  const objetivos = A.objetivos.map(x => `<tr class="obj-${x.tono}"><th scope="row">${enLinea(x.objetivo)}</th><td>${enLinea(x.lista)}</td><td>${enLinea(x.profundo)}</td><td>${enLinea(x.limite)}</td></tr>`).join('');
  const escalera = A.escalera.map(x => `<tr><th scope="row">${enLinea(x.aparato)}<span class="ej">${enLinea(x.ejemplos)}</span></th><td class="num">${enLinea(x.nucleo)}</td><td class="num">${enLinea(x.hoy)}</td><td class="num">${enLinea(x.lista)}</td><td class="num">${enLinea(x.fondo)}</td><td><span class="ver-txt v-${x.tono}">${enLinea(x.veredicto)}</span></td></tr>`).join('');
  const presupuesto = A.presupuesto.map(x => `<tr><th scope="row">${enLinea(x.pieza)}</th><td>${enLinea(x.donde)}</td><td class="num-txt">${enLinea(x.hoy)}</td><td class="meta-txt">${enLinea(x.meta)}</td><td class="num-txt">${enLinea(x.media)}</td><td class="como">${enLinea(x.como)}</td></tr>`).join('');
  const alcanza = `<section id="alcanza"><h2>¿Alcanza? La respuesta honesta</h2>
<p class="veredicto-grande v-${A.tono || 'no'}">${enLinea(A.veredicto)}</p>
${parrafosHtml(A.texto)}
<div class="desliza"><table class="objetivos"><thead><tr><th>Objetivo</th><th>${esc(A.columnas.lista)}</th><th>${esc(A.columnas.profundo)}</th><th>Lo que ningún plan arregla</th></tr></thead><tbody>${objetivos}</tbody></table></div>
<h3>La escalera de aparatos</h3>${parrafosHtml(A.escaleraIntro)}${diagramaEscalera()}
<div class="desliza"><table class="escalera"><caption>${esc(A.columnas.caption)}</caption><thead><tr><th>Aparato</th><th>${esc(A.columnas.nucleo)}</th><th>${esc(A.columnas.hoy)}</th><th>${esc(A.columnas.escLista)}</th><th>${esc(A.columnas.escFondo)}</th><th>¿60 en el navegador?</th></tr></thead><tbody>${escalera}</tbody></table></div>
<h3 id="presupuesto">${esc(A.presupuestoTitulo)}</h3>${parrafosHtml(A.presupuestoIntro)}${diagramaHilos()}
<div class="desliza"><table class="presupuesto"><caption>${esc(A.columnas.pCaption)}</caption><thead><tr><th>Pieza</th><th>Dónde corre</th><th>${esc(A.columnas.pHoy)}</th><th>${esc(A.columnas.pMeta)}</th><th>${esc(A.columnas.pMedia)}</th><th>Con qué</th></tr></thead><tbody>${presupuesto}</tbody></table></div>
<div class="techo">${parrafosHtml(A.techo)}</div>
<h3>Qué cambia en el plan</h3>${parrafosHtml(A.cambios)}</section>`;
  const chipsItems = p => p.items.map(id => `<a href="#${id}" class="ref-item" title="${esc(porId[id].titulo.replace(/\*\*|`|\[\[|\]\]/g, ''))}">${id}</a>`).join(' ');
  const filasOrden = vivos.map(p => `<tr${p.paralelo ? ' class="paralelo"' : ''}><th scope="row"><span class="paso-num">${p.n}</span></th><td><strong>${enLinea(p.nombre)}.</strong> ${enLinea(p.que)}<span class="paso-items">${chipsItems(p)}</span></td><td class="num">${esc(p.fase)}</td><td>${enLinea(p.duracion)}</td><td class="num">${rango(tramo[p.n].fin)}</td><td>${p.dueno ? enLinea(p.dueno) : '—'}</td></tr>`).join('');
  const filasHistoria = historia.map(p => `<tr><th scope="row"><span class="paso-num">${p.n}</span></th><td><strong>${enLinea(p.nombre)}.</strong> ${enLinea(p.que)}<span class="paso-items">${chipsItems(p)}</span></td><td>${enLinea(p.duracion)}</td></tr>`).join('');
  const ordenHtml = `<section id="orden"><h2>Orden de trabajo y cuánto tarda</h2>${parrafosHtml(D.ordenIntro)}${diagramaOrden()}
<div class="desliza"><table class="orden"><thead><tr><th>Etapa</th><th>Qué</th><th>Fase</th><th>Dura</th><th>Termina hacia la semana</th><th>Lo que haces tú</th></tr></thead><tbody>${filasOrden}</tbody></table></div>
<p class="total-orden">${enLinea(totalTexto)}</p>
<h3 id="hecho">Lo ya hecho (versiones 1–3)</h3>${parrafosHtml(D.historiaIntro)}
<div class="desliza"><table class="orden"><thead><tr><th>Paso viejo</th><th>Qué, y los ítems que quedaron aquí (hechos o descartados)</th><th>Duró (estimado entonces)</th></tr></thead><tbody>${filasHistoria}</tbody></table></div></section>`;
  const pct = Math.round(itemsCerrados / todos.length * 100);   // (el dueño, 2026-11-06: los descartados cuentan como cerrados)
  const pasoAvance = p => {
    const n = p.items.filter(cerrado).length;
    const items = p.items.map(id => casillaHtml(id, `<a href="#${id}" class="ref-item">${id}</a> ${enLinea(porId[id].titulo)}`)).join('');
    const listo = p.listo.map((c, k) => casillaHtml(claveCriterio(p, k), enLinea(c))).join('');
    return `<section class="paso-av" aria-labelledby="pa-${p.n}"><h3 id="pa-${p.n}"><span class="paso-num">${p.n}</span><span>${enLinea(p.nombre)}</span><span class="paso-cuenta">${n}/${p.items.length}</span></h3><ul class="checks">${items}</ul><span class="lbl">Listo cuando</span><ul class="checks">${listo}</ul></section>`;
  };
  const avanceHtml = `<section id="avance"><h2>Avance</h2>${parrafosHtml(D.avanceIntro)}
<div class="progreso" role="img" aria-label="${itemsCerrados} de ${todos.length} ítems cerrados"><div class="progreso-barra" style="width:${pct}%"></div></div>
<p class="progreso-txt"><strong>${itemsCerrados} de ${todos.length} ítems cerrados</strong> (${pct} %): ${itemsHechos} hechos y ${itemsCerrados - itemsHechos} descartados · ${pasosCerrados} de ${vivos.length} etapas de la versión 4 cerradas · ${viejosCerrados} de ${historia.length} pasos viejos cerrados</p>
<div class="avance-pasos">${vivos.map(pasoAvance).join('\n')}</div>
<h3>Lo ya hecho (versiones 1–3)</h3>
<div class="avance-pasos">${historia.map(pasoAvance).join('\n')}</div></section>`;
  return `<title>JloKart Wii a 60 fps</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&family=Saira+Semi+Condensed:wght@500;600;700&display=swap">
<style>${CSS}</style>
<div class="pagina">
<header class="cabecera">
<p class="ceja">Plan de rendimiento · ${esc(D.meta.fecha)} · ${esc(estado)}</p>
<h1>JloKart Wii a 60 fps</h1>
<p class="bajada">${enLinea(D.meta.subtitulo)}</p>
<div class="ficha">${ficha}</div>
<nav class="indice" aria-label="Secciones"><a href="#alcanza">¿Alcanza?</a><a href="#presupuesto">Presupuesto</a><a href="#respuesta">Respuesta corta</a><a href="#cuadro">El cuadro</a><a href="#asincrono">¿Asíncrono?</a><a href="#cuestionar">Cuestionar todo</a><a href="#lista">La lista (${todos.length})</a><a href="#pasos">Paso a paso</a><a href="#almacen">Datos guardados</a><a href="#reglas">Reglas</a><a href="#glosario">Glosario</a><a href="#orden">Orden y tiempo</a><a href="#hecho">Lo ya hecho</a><a href="#avance">Avance</a></nav>
</header>
<main>
<section id="pedido"><h2>Lo que pediste</h2><ul class="pedido">${D.pedido.map(p => `<li>${enLinea(p)}</li>`).join('')}</ul></section>
${alcanza}
<section id="respuesta"><h2>Respuesta corta</h2><div class="respuestas">${respuesta}</div></section>
<section id="cuadro"><h2>Dónde se van los 16,7 ms</h2>${parrafosHtml(D.cuadro.texto)}${diagramaCuadro()}
<div class="desliza"><table><caption>Reparto del cuadro en el PC del proyecto (§85)</caption><thead><tr><th>Parte</th><th>Fuera de la sala</th><th>Sala</th></tr></thead><tbody>${D.cuadro.reparto.map(f => `<tr><th scope="row">${enLinea(f[0])}</th><td class="num">${f[1]}</td><td class="num">${f[2]}</td></tr>`).join('')}</tbody></table></div></section>
<section id="asincrono"><h2>¿Se puede hacer el multijugador asíncrono?</h2>${parrafosHtml(D.asincronia.texto)}${diagramaRed()}
<div class="desliza"><table class="opciones"><thead><tr><th>Opción</th><th>Qué es</th><th>Veredicto</th><th>Esfuerzo</th></tr></thead><tbody>${opciones}</tbody></table></div>${parrafosHtml(D.asincronia.cierre)}</section>
<section id="cuestionar"><h2>Cuestionar todo, capa por capa</h2>${parrafosHtml(D.cuestionarIntro)}<div class="desliza"><table class="cuestionar"><thead><tr><th>Capa</th><th>Hoy</th><th>Veredicto</th><th>Por qué</th><th>Costo</th></tr></thead><tbody>${cuestionar}</tbody></table></div></section>
<section id="lista"><h2>La lista: ${todos.length} cosas que arreglar</h2>
<p>Cada ítem dice qué pasa, cómo se arregla y cómo se comprueba. <strong>${conteo('urgente')} urgentes</strong> (causan el lag o las trabas de hoy), ${conteo('alta')} de prioridad alta, ${conteo('media')} media y ${conteo('investigar')} para investigar si lo demás no alcanza. «Medido» es un número que ya existe; «Leído en el código» se vio sin correr nada; «Sospecha» hay que confirmarla.</p>
<div class="filtros" role="group" aria-label="Filtrar la lista">
<button type="button" id="f-todo" data-f="todo" aria-pressed="true">Todo</button>
<button type="button" id="f-v4" data-f="v4" aria-pressed="false">Nuevo en la versión 4</button>
<button type="button" id="f-gama" data-f="gama" aria-pressed="false">Gama media (v3)</button>
<button type="button" id="f-nuevo" data-f="nuevo" aria-pressed="false">Lo profundo (v2)</button>
<button type="button" id="f-urgente" data-f="urgente" aria-pressed="false">Urgente</button>
<button type="button" id="f-celular" data-f="celular" aria-pressed="false">Celular</button>
<button type="button" id="f-pc" data-f="pc" aria-pressed="false">PC</button>
<button type="button" id="f-uno" data-f="uno" aria-pressed="false">Un jugador</button>
<button type="button" id="f-sala" data-f="sala" aria-pressed="false">Sala</button>
<button type="button" id="f-r2" data-f="r2" aria-pressed="false">Volver a subir R2</button>
<button type="button" id="f-decompilar" data-f="decompilar" aria-pressed="false">Decompilar</button>
<span class="cuenta" id="cuenta" aria-live="polite">${todos.length} ítems</span></div>
${areas}</section>
<section id="pasos"><h2>Paso a paso</h2>${parrafosHtml(D.fasesIntro)}<ol class="fases">${fases}</ol></section>
<section id="almacen"><h2>Dónde se guardan los datos</h2>${parrafosHtml(D.almacen.intro)}<div class="desliza"><table><thead><tr><th>Qué</th><th>Dónde</th><th>Cuánto y notas</th></tr></thead><tbody>${D.almacen.filas.map(f => `<tr><th scope="row">${enLinea(f[0])}</th><td>${enLinea(f[1])}</td><td>${enLinea(f[2])}</td></tr>`).join('')}</tbody></table></div>${parrafosHtml(D.almacen.pcTelefono)}</section>
<section id="reglas"><h2>Reglas que no cambian</h2><ul>${D.reglas.map(r => `<li>${enLinea(r)}</li>`).join('')}</ul>
<h3>Lo que queda para que decidas tú</h3><ul>${D.decisiones.map(r => `<li>${enLinea(r)}</li>`).join('')}</ul></section>
<section id="glosario"><h2>Glosario corto</h2><dl class="glosario">${D.glosario.map(g => `<div><dt>${enLinea(g[0])}</dt><dd>${enLinea(g[1])}</dd></div>`).join('')}</dl></section>
${ordenHtml}
${avanceHtml}
<footer class="pie">${parrafosHtml(D.fuentes)}</footer>
</main></div>
<script>${JS}</script>`;
}

const CSS = `
/* Layout: una hoja de especificaciones de ingeniería en una columna de lectura; la lista son filas con su código a la izquierda (como un plano con referencias) y un diagrama de tiempos a escala del cuadro de 16,7 ms. */
:root {
  --bg: #f2f4f7; --surface: #ffffff; --fg: #141923; --muted: #586274; --line: #d5dbe5; --line-soft: #e6eaf0;
  --accent: #1d4fd6; --accent-soft: #e2e9fb;
  --urgente: #b8261a; --urgente-soft: #fbe5e1; --alta: #a55400; --alta-soft: #fbeed9; --media: #2f6a2c; --media-soft: #e2efdc; --invest: #5745a6; --invest-soft: #ebe7f8;
  --bien: #2f7d3a; --borde: #c27a00; --mal: #c0392b; --est: #7d8aa3;
  --f-display: "Saira Semi Condensed", "Arial Narrow", "Segoe UI", sans-serif;
  --f-body: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
  --f-mono: "JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0e131b; --surface: #151c27; --fg: #e6ebf3; --muted: #9ba6b9; --line: #2a3445; --line-soft: #202937;
  --accent: #82a5ff; --accent-soft: #1b2847;
  --urgente: #ff8574; --urgente-soft: #3b1d1a; --alta: #ffb25e; --alta-soft: #3a2a15; --media: #93d282; --media-soft: #1c2d19; --invest: #b9aaff; --invest-soft: #272142;
  --bien: #6fcf7f; --borde: #f0b44c; --mal: #ff7b6b; --est: #8994ab; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #0e131b; --surface: #151c27; --fg: #e6ebf3; --muted: #9ba6b9; --line: #2a3445; --line-soft: #202937;
  --accent: #82a5ff; --accent-soft: #1b2847;
  --urgente: #ff8574; --urgente-soft: #3b1d1a; --alta: #ffb25e; --alta-soft: #3a2a15; --media: #93d282; --media-soft: #1c2d19; --invest: #b9aaff; --invest-soft: #272142;
  --bien: #6fcf7f; --borde: #f0b44c; --mal: #ff7b6b; --est: #8994ab; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font: 16px/1.6 var(--f-body); }
.pagina { max-width: 980px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px; }
h1, h2, h3, h4 { font-family: var(--f-display); text-wrap: balance; line-height: 1.15; letter-spacing: .005em; }
h1 { font-size: clamp(2.3rem, 6vw, 3.6rem); font-weight: 700; margin: 0 0 .25em; }
h2 { font-size: clamp(1.55rem, 3.4vw, 2.05rem); font-weight: 700; margin: 2.4em 0 .6em; padding-top: .6em; border-top: 2px solid var(--fg); }
h3 { font-size: 1.28rem; font-weight: 600; margin: 1.6em 0 .5em; }
h4 { font-size: 1.12rem; font-weight: 600; margin: 0 0 .35em; }
p, li, dd { max-width: 72ch; }
a { color: var(--accent); }
a:focus-visible, button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
code { font-family: var(--f-mono); font-size: .86em; background: var(--line-soft); padding: .05em .35em; border-radius: 4px; overflow-wrap: anywhere; }
.ceja { font: 600 .82rem var(--f-mono); text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 .6em; }
.bajada { font-size: 1.15rem; color: var(--muted); margin: 0 0 1.4em; }
.ficha { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.dato { background: var(--surface); padding: 12px 14px; display: grid; gap: 2px; min-width: 0; }
.dato-v { font: 700 1.35rem/1.2 var(--f-display); font-variant-numeric: tabular-nums; }
.dato-l { font-size: .86rem; color: var(--muted); line-height: 1.35; }
.indice { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 18px; font-size: .95rem; }
.indice a { text-decoration: none; border-bottom: 1px solid var(--line); }
.indice a:hover { border-color: var(--accent); }
.pedido li { margin-bottom: .35em; }
.respuestas { display: grid; gap: 14px; }
.resp { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 18px; min-width: 0; }
.resp h3 { margin: 0 0 .3em; font-size: 1.12rem; }
.veredicto { font-weight: 700; margin: 0 0 .4em; }
.v-si { color: var(--bien); } .v-parcial { color: var(--borde); } .v-no { color: var(--mal); }
.resp p:last-child { margin-bottom: 0; }
.veredicto-grande { font: 700 1.28rem/1.35 var(--f-display); margin: 0 0 .8em; padding: 12px 16px; background: var(--surface); border: 1px solid var(--line); border-left: 6px solid currentColor; border-radius: 0 8px 8px 0; max-width: none; }
table.objetivos { min-width: 760px; }
.obj-si th { box-shadow: inset 4px 0 0 var(--bien); } .obj-parcial th { box-shadow: inset 4px 0 0 var(--borde); } .obj-no th { box-shadow: inset 4px 0 0 var(--mal); }
table.escalera { min-width: 880px; margin-top: 4px; }
.escalera .ej { display: block; font-weight: 400; font-size: .84rem; color: var(--muted); }
.escalera tbody th { min-width: 200px; } .escalera td:last-child { min-width: 190px; }
.ver-txt { font-weight: 700; }
.techo { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 0 8px 8px 0; padding: 12px 18px; margin: 22px 0; }
.techo p:last-child { margin-bottom: 0; }
svg .barra-hoy { fill: var(--line); }
svg .barra-hoy-est { fill: none; stroke: var(--muted); stroke-width: 1.6; stroke-dasharray: 5 3; }
svg .est-bien { fill: var(--media-soft); stroke: var(--bien); stroke-width: 2; stroke-dasharray: 5 3; }
svg .est-borde { fill: var(--alta-soft); stroke: var(--borde); stroke-width: 2; stroke-dasharray: 5 3; }
svg .est-mal { fill: var(--urgente-soft); stroke: var(--mal); stroke-width: 2; stroke-dasharray: 5 3; }
table.presupuesto { min-width: 900px; margin-top: 4px; }
.presupuesto tbody th { min-width: 190px; }
.presupuesto td.num-txt { font-family: var(--f-mono); font-size: .86rem; font-variant-numeric: tabular-nums; }
.presupuesto td.meta-txt { font-family: var(--f-mono); font-weight: 700; color: var(--bien); white-space: nowrap; }
.presupuesto td.como { min-width: 150px; }
.presupuesto td.como .ref-item { display: inline-block; margin: 0 3px 3px 0; }
svg .seg-hoy { fill: var(--line); stroke: var(--surface); stroke-width: 1.5; }
svg .seg-txt { font: 11.5px var(--f-body); fill: var(--fg); }
svg .halo { paint-order: stroke; stroke: var(--surface); stroke-width: 4px; stroke-linejoin: round; }
svg .eje-meta { stroke: var(--bien); stroke-width: 1.5; stroke-dasharray: 2 3; }
svg .nota-meta { fill: var(--bien); font: 700 11.5px var(--f-body); }
svg .barra-plan { fill: var(--accent); }
svg .barra-plan-par { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.5; }
svg .barra-hecha { fill: var(--bien); }
table.orden { min-width: 880px; }
.orden td:nth-child(2) { min-width: 300px; }
.orden tr.paralelo th { box-shadow: inset 4px 0 0 var(--accent); }
.paso-num { font: 700 .95rem var(--f-mono); display: inline-grid; place-items: center; min-width: 28px; height: 28px; border-radius: 50%; background: var(--fg); color: var(--bg); flex: none; }
.paso-items { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.total-orden { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 0 8px 8px 0; padding: 10px 16px; max-width: none; }
.progreso { height: 12px; background: var(--line-soft); border: 1px solid var(--line); border-radius: 999px; overflow: hidden; margin: 12px 0 6px; }
.progreso-barra { height: 100%; background: var(--bien); }
.progreso-txt { font-size: .95rem; }
.avance-pasos { display: grid; gap: 14px; margin-top: 14px; }
.paso-av { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; min-width: 0; }
.paso-av h3 { display: flex; gap: 10px; align-items: center; margin: 0 0 .6em; font-size: 1.1rem; }
.paso-cuenta { margin-left: auto; font: 600 .82rem var(--f-mono); color: var(--muted); white-space: nowrap; }
.checks { list-style: none; padding: 0; margin: .2em 0 .7em; display: grid; gap: 5px; }
.ck { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; align-items: start; max-width: none; }
.caja { width: 18px; height: 18px; margin-top: 3px; border: 2px solid var(--muted); border-radius: 4px; display: grid; place-items: center; font: 700 12px/1 var(--f-body); }
.ck-hecho .caja { background: var(--bien); border-color: var(--bien); }
.ck-hecho .caja::after { content: "✓"; color: var(--surface); }
.ck-en-curso .caja { border-color: var(--borde); background: linear-gradient(90deg, var(--borde) 50%, transparent 50%); }
.ck-descartado .caja { border-color: var(--muted); }
.ck-descartado .caja::after { content: "–"; color: var(--muted); }
.ck-descartado .ck-txt { text-decoration: line-through; color: var(--muted); }
.ck-meta { display: inline-block; margin-left: 8px; font: .8rem var(--f-mono); color: var(--muted); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.diagrama { margin: 20px 0; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 12px 8px; }
.diagrama svg { display: block; width: 100%; min-width: 560px; height: auto; }
.diagrama-red svg { max-width: 640px; min-width: 460px; margin: 0 auto; }
.diagrama figcaption { font-size: .9rem; color: var(--muted); padding: 6px 4px 2px; max-width: 80ch; }
.desliza { overflow-x: auto; max-width: 100%; }
svg .eje { stroke: var(--line); stroke-width: 1; }
svg .eje-clave { stroke: var(--fg); stroke-width: 1.4; stroke-dasharray: 4 4; }
svg .tick, svg .rotulo, svg .valor, svg .titulito, svg .nota-clave { fill: var(--fg); font-family: var(--f-body); }
svg .tick { font-size: 11px; fill: var(--muted); font-variant-numeric: tabular-nums; }
svg .rotulo { font-size: 12.5px; }
svg .valor { font-size: 12px; font-family: var(--f-mono); }
svg .nota-clave { font-size: 11.5px; font-weight: 700; }
svg .titulito { font-size: 13px; font-weight: 700; }
svg .barra-bien { fill: var(--bien); } svg .barra-borde { fill: var(--borde); } svg .barra-mal { fill: var(--mal); }
svg .barra-est { fill: none; stroke: var(--est); stroke-width: 2; stroke-dasharray: 5 3; }
svg .bigote { stroke: var(--fg); stroke-width: 1.6; }
svg .arista { stroke: var(--muted); stroke-width: 1.2; opacity: .55; }
svg .arista-fuerte { stroke: var(--accent); stroke-width: 2; }
svg .nodo { fill: var(--surface); stroke: var(--fg); stroke-width: 2; }
svg .nodo-lento { fill: var(--urgente-soft); stroke: var(--urgente); stroke-width: 2.4; }
svg .nodo-arbitro { fill: var(--accent); }
svg .rotulo-arb { fill: var(--surface); font: 700 10.5px var(--f-body); }
table { border-collapse: collapse; width: 100%; font-size: .93rem; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
caption { text-align: left; font-size: .9rem; color: var(--muted); padding: 0 0 6px; caption-side: top; }
th, td { text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--line-soft); }
thead th { font: 600 .78rem var(--f-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); background: var(--bg); }
tbody th { font-weight: 700; }
td.num { font-family: var(--f-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
td.costo { white-space: nowrap; color: var(--muted); }
table.opciones, table.cuestionar { min-width: 760px; }
.op-recomendado th { box-shadow: inset 4px 0 0 var(--bien); }
.op-descartado th { box-shadow: inset 4px 0 0 var(--mal); }
.op-posible th { box-shadow: inset 4px 0 0 var(--borde); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 10px; }
.chip { display: inline-block; font: 600 .74rem/1.5 var(--f-mono); padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; }
.prio-urgente { background: var(--urgente-soft); color: var(--urgente); border-color: transparent; }
.prio-alta { background: var(--alta-soft); color: var(--alta); border-color: transparent; }
.prio-media { background: var(--media-soft); color: var(--media); border-color: transparent; }
.prio-investigar { background: var(--invest-soft); color: var(--invest); border-color: transparent; }
.bandera { border-style: dashed; color: var(--fg); }
.fuente { color: var(--accent); border-color: var(--accent-soft); background: var(--accent-soft); }
.ver-mantener { background: var(--media-soft); color: var(--media); border-color: transparent; }
.ver-mejorar { background: var(--accent-soft); color: var(--accent); border-color: transparent; }
.ver-cambiar { background: var(--alta-soft); color: var(--alta); border-color: transparent; }
.ver-probar, .ver-despues { background: var(--invest-soft); color: var(--invest); border-color: transparent; }
.ver-no { background: var(--urgente-soft); color: var(--urgente); border-color: transparent; }
.filtros { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 16px 0 6px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.filtros button { font: 600 .86rem var(--f-body); color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 5px 13px; cursor: pointer; }
.filtros button[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.cuenta { margin-left: auto; font: 600 .82rem var(--f-mono); color: var(--muted); }
.area h3 { display: flex; align-items: baseline; gap: 12px; margin-top: 2em; }
.area-id { font: 700 1rem var(--f-mono); color: var(--surface); background: var(--fg); padding: 1px 9px; border-radius: 5px; }
.items { display: grid; gap: 0; border-top: 1px solid var(--line); }
.item { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 14px; padding: 18px 0; border-bottom: 1px solid var(--line); scroll-margin-top: 16px; }
.item-id span { display: inline-block; font: 700 1.05rem var(--f-mono); color: var(--accent); }
.item:target { background: var(--accent-soft); }
.campo { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 4px 12px; margin: 6px 0; }
.campo p, .campo ul { margin: 0 0 .4em; }
.lbl { font: 600 .74rem/1.9 var(--f-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.refs { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 4px 12px; margin: 8px 0 0; font-size: .88rem; }
.refs code { background: none; padding: 0; color: var(--muted); }
.ref-item { font: 600 .86em var(--f-mono); text-decoration: none; background: var(--accent-soft); padding: 0 5px; border-radius: 4px; }
.fases { list-style: none; padding: 0; display: grid; gap: 16px; counter-reset: fase; }
.fase { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; min-width: 0; }
.fase-cab { display: flex; gap: 14px; align-items: center; }
.fase-n { font: 700 1.6rem var(--f-display); width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; background: var(--fg); color: var(--bg); flex: none; }
.fase h3 { margin: 0; }
.fase-dur { margin: 0; color: var(--muted); font-size: .92rem; }
.fase-items { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.fase-items .lbl { margin-right: 6px; }
.fase-cols { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 18px; }
.fase-cols ol, .fase-cols ul { padding-left: 1.2em; margin: .3em 0 .8em; }
.listo li::marker { content: "✓  "; color: var(--bien); }
.glosario { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px 24px; }
.glosario dt { font-weight: 700; }
.glosario dd { margin: 0; color: var(--muted); font-size: .95rem; }
.pie { margin-top: 3em; padding-top: 1em; border-top: 1px solid var(--line); font-size: .88rem; color: var(--muted); }
@media (max-width: 640px) {
  .item { grid-template-columns: 1fr; gap: 4px; }
  .campo, .refs { grid-template-columns: 1fr; gap: 0; }
  .fase-cols { grid-template-columns: 1fr; }
  .cuenta { margin-left: 0; width: 100%; }
}
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`;

const JS = `
(function () {
  var botones = Array.prototype.slice.call(document.querySelectorAll('.filtros button'));
  var items = Array.prototype.slice.call(document.querySelectorAll('.item'));
  var areas = Array.prototype.slice.call(document.querySelectorAll('.area'));
  var cuenta = document.getElementById('cuenta');
  function pasa(el, f) {
    if (f === 'todo') return true;
    if (f === 'urgente') return el.dataset.prio === 'urgente';
    if (f === 'nuevo') return el.id.charAt(0) === 'N';
    if (f === 'gama') return el.id.charAt(0) === 'H';
    if (f === 'v4') return el.id.charAt(0) === 'W';
    if (f === 'celular' || f === 'pc') return el.dataset.aparato === f || el.dataset.aparato === 'ambos';
    if (f === 'uno' || f === 'sala') return el.dataset.modo === f || el.dataset.modo === 'ambos';
    return (' ' + el.dataset.banderas + ' ').indexOf(' ' + f + ' ') >= 0;
  }
  function aplicar(f) {
    var n = 0;
    items.forEach(function (el) { var si = pasa(el, f); el.hidden = !si; if (si) n++; });
    areas.forEach(function (a) { a.hidden = !a.querySelector('.item:not([hidden])'); });
    botones.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.f === f)); });
    cuenta.textContent = n + (n === 1 ? ' ítem' : ' ítems');
    try { localStorage.setItem('plan60.filtro', f); } catch (e) {}
  }
  botones.forEach(function (b) { b.addEventListener('click', function () { aplicar(b.dataset.f); }); });
  var guardado = 'todo';
  try { guardado = localStorage.getItem('plan60.filtro') || 'todo'; } catch (e) {}
  if (location.hash && document.getElementById(location.hash.slice(1))) guardado = 'todo';
  if (guardado !== 'todo') aplicar(guardado);
})();
`;

if (salMd) writeFileSync(salMd, md(), 'utf8');
if (salHtml) writeFileSync(salHtml, html(), 'utf8');
console.log(`ítems: ${todos.length} (urgentes ${todos.filter(i => i.prio === 'urgente').length}) · fases: ${D.fases.length} · capas: ${D.cuestionar.length}`);
