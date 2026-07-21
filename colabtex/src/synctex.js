"use strict";
/* ============================================================
   Parser de SyncTeX (formato v1 sin comprimir, tal como lo emite
   pdflatex con --synctex=-1).

   Sirve para las dos direcciones:
     - forward(archivo, línea)  → {page, x, y, h, w}  dónde mirar en el PDF
     - inverse(page, x, y)      → {file, line}        dónde está en el código

   Estructura del fichero:

       SyncTeX Version:1
       Input:1:/ruta/main.tex          ← tabla de «tags» (id → archivo)
       Input:10:/ruta/otro.tex
       ...
       Unit:1
       X Offset:0
       Y Offset:0
       Content:
       {1                              ← empieza la página 1
       [1,17:4736286,46220574:26673152,41484288,0
       (1,4:8799518,8865054:22609920,655359,0
       h1,6:9272834,10300473
       ...
       }                               ← fin de página

   Cada registro es  TIPO tag,línea:x,y[:ancho,alto,profundidad]
   Tipos: [ ] cajas verticales, ( ) horizontales, h v x k g cajas y
   pegamento sueltos. Las coordenadas van en «scaled points» (sp):
   65536 sp = 1 pt, y el origen es la esquina SUPERIOR izquierda.
   ============================================================ */

const SP_PER_PT = 65536;

/* Registro con posición: tipo, tag, línea, x, y y (opcional) w,h,d */
const REC = /^([\[\(hvxkg\$])(\d+),(\d+)(?::(-?\d+),(-?\d+))?(?::(-?\d+),(-?\d+),(-?\d+))?/;

export class SyncTex {
  /* text: contenido del .synctex; projectDir: prefijo a recortar de las rutas */
  constructor(text, projectDir = "/home/web_user/project_dir/") {
    this.tags = new Map();        // tag → nombre de archivo del proyecto
    this.byFile = new Map();      // archivo → [{line, page, x, y, w, h, d}]
    this.byPage = new Map();      // página → [{line, tag, x, y, w, h, d}]
    this.ok = false;
    if (text) this._parse(text, projectDir);
  }

  _parse(text, projectDir) {
    const lines = text.split("\n");
    let page = 0, inContent = false;

    for (const raw of lines) {
      if (!raw) continue;

      if (!inContent) {
        const inp = raw.match(/^Input:(\d+):(.*)$/);
        if (inp) {
          let p = inp[2].trim();
          // solo interesan los archivos del proyecto, no los de TeX Live
          if (p.startsWith(projectDir)) {
            p = p.slice(projectDir.length).replace(/^\.\//, "");
            this.tags.set(+inp[1], p);
          }
          continue;
        }
        if (raw.startsWith("Content:")) { inContent = true; }
        continue;
      }

      const c = raw[0];
      if (c === "{" || c === "<") { page = parseInt(raw.slice(1), 10) || page; continue; }
      if (c === "}" || c === ">") { page = 0; continue; }
      if (!page) continue;

      const m = raw.match(REC);
      if (!m) continue;
      const tag = +m[2], line = +m[3];
      const file = this.tags.get(tag);
      if (!file) continue;                       // registro de un .sty/.cls: ignorar

      const rec = {
        file, line, page, tag,
        x: m[4] !== undefined ? +m[4] : 0,
        y: m[5] !== undefined ? +m[5] : 0,
        w: m[6] !== undefined ? +m[6] : 0,
        h: m[7] !== undefined ? +m[7] : 0,
        d: m[8] !== undefined ? +m[8] : 0
      };

      if (!this.byFile.has(file)) this.byFile.set(file, []);
      this.byFile.get(file).push(rec);
      if (!this.byPage.has(page)) this.byPage.set(page, []);
      this.byPage.get(page).push(rec);
      this.ok = true;
    }

    // ordenar por línea para poder buscar el registro más cercano
    for (const arr of this.byFile.values()) arr.sort((a, b) => a.line - b.line);
  }

  /* ---- código → PDF ----
     Devuelve la posición en PUNTOS desde la esquina superior izquierda.
     Si la línea exacta no tiene registro (por ejemplo una línea en blanco
     o un \begin{...}), se usa la más cercana hacia abajo, y si no la hay,
     la más cercana hacia arriba. */
  forward(file, line) {
    const arr = this.byFile.get(file) || this.byFile.get(file.replace(/^\.\//, ""));
    if (!arr || !arr.length) return null;

    let best = null;
    for (const r of arr) {
      if (r.line === line) { best = r; break; }
      if (r.line > line) { best = r; break; }
    }
    if (!best) best = arr[arr.length - 1];

    // entre todos los registros de esa línea, quedarse con el más alto
    // de la página (el primero en aparecer verticalmente)
    const same = arr.filter(r => r.line === best.line && r.page === best.page);
    for (const r of same) if (r.y < best.y) best = r;

    return {
      page: best.page,
      x: best.x / SP_PER_PT,
      y: best.y / SP_PER_PT,
      w: best.w / SP_PER_PT,
      h: (best.h + best.d) / SP_PER_PT,
      exact: best.line === line
    };
  }

  /* ---- PDF → código ----
     x,y en PUNTOS desde la esquina superior izquierda de la página.

     Se hace en dos etapas, como el synctex_edit original:
       1) la caja más pequeña que contiene el punto (acota la región);
       2) dentro de ella, el registro cuya posición esté más cerca.
     El paso 2 es imprescindible: los registros de tamaño cero (glue,
     kern, el inicio de un \input) son los MÁS específicos, pero nunca
     «contienen» un punto, así que sin él un clic sobre texto de un
     archivo incluido devolvería la línea del \input en el padre. */
  inverse(page, xPt, yPt) {
    const arr = this.byPage.get(page);
    if (!arr || !arr.length) return null;
    const x = xPt * SP_PER_PT, y = yPt * SP_PER_PT;

    const contains = r => {
      if (!(r.w > 0 && r.h + r.d > 0)) return false;
      // y es la línea base: la caja va de y-h a y+d
      const x0 = Math.min(r.x, r.x + r.w), x1 = Math.max(r.x, r.x + r.w);
      return x >= x0 && x <= x1 && y >= r.y - r.h && y <= r.y + r.d;
    };

    let box = null, boxArea = Infinity;
    for (const r of arr) {
      if (!contains(r)) continue;
      const area = Math.abs(r.w) * (r.h + r.d);
      if (area < boxArea) { box = r; boxArea = area; }
    }

    // candidatos: los registros dentro de la caja hallada (o todos si no hay)
    const inBox = box
      ? arr.filter(r => {
          const x0 = Math.min(box.x, box.x + box.w), x1 = Math.max(box.x, box.x + box.w);
          return r.x >= x0 - 1 && r.x <= x1 + 1 && r.y >= box.y - box.h - 1 && r.y <= box.y + box.d + 1;
        })
      : arr;

    /* La propia caja contenedora se excluye: buscamos un HIJO suyo, que es
       más específico. Sin esto, la caja del párrafo (que pertenece al
       archivo padre, donde está el \input) empata en distancia con el
       primer registro del archivo incluido y gana por orden de aparición. */
    let cand = inBox.filter(r => r !== box);
    if (!cand.length) cand = box ? [box] : arr;

    let best = null, bestD = Infinity, bestArea = Infinity;
    for (const r of cand) {
      const dx = r.x - x, dy = r.y - y;
      // la distancia vertical pesa más: importa sobre todo acertar de línea
      const d2 = dx * dx + 4 * dy * dy;
      const area = Math.abs(r.w) * (r.h + r.d);
      // a igual distancia gana el registro más pequeño (la hoja, no la caja)
      if (d2 < bestD || (d2 === bestD && area < bestArea)) {
        bestD = d2; bestArea = area; best = r;
      }
    }

    return best ? { file: best.file, line: best.line, exact: !!box } : null;
  }
}
