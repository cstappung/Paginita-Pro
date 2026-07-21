"use strict";
/* ============================================================
   Proveedor Yjs sobre Firebase Realtime Database.
   Sustituye a y-websocket: sincroniza el Y.Doc del proyecto y la
   presencia/cursores (awareness) a través de RTDB.

   projects/<pid>/doc/snapshot        estado consolidado (base64)
   projects/<pid>/doc/updates/<key>   updates incrementales (base64)
   presence/<pid>/<clientID>          awareness de cada cliente
   ============================================================ */
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness.js";
import {
  ref, get, set, update, remove, push, onChildAdded, onChildChanged,
  onChildRemoved, onValue, onDisconnect, serverTimestamp, off
} from "firebase/database";
import { db } from "./firebase.js";

/* ---- base64 ↔ Uint8Array ---- */
export function b64FromBytes(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function bytesFromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const COMPACT_THRESHOLD = 80;   // nº de updates sueltos antes de consolidar
const AWARENESS_REFRESH = 20000;

export class RtdbProvider {
  constructor(pid, ydoc, { readOnly = false } = {}) {
    this.pid = pid;
    this.doc = ydoc;
    this.readOnly = readOnly;
    this.awareness = new awarenessProtocol.Awareness(ydoc);
    this.synced = false;
    this._events = {};
    this._appliedKeys = new Set();
    this._unsubs = [];
    this._destroyed = false;
    this._pending = 0;          // escrituras en vuelo hacia RTDB

    this.updatesRef = ref(db, `projects/${pid}/doc/updates`);
    this.snapshotRef = ref(db, `projects/${pid}/doc/snapshot`);
    this.presenceRef = ref(db, `presence/${pid}`);
    this.myPresenceRef = ref(db, `presence/${pid}/${ydoc.clientID}`);

    this._docUpdateHandler = (u, origin) => {
      if (origin === this || this.readOnly) return;
      /* Si el proveedor está cerrado, este cambio NO va a llegar a la nube.
         Antes se descartaba en silencio y la sesión parecía normal hasta
         que al recargar faltaba todo, así que ahora se avisa. */
      if (this._destroyed) {
        this.emit("error", [new Error("La conexión con la nube está cerrada: este cambio no se ha guardado.")]);
        return;
      }
      const p = push(this.updatesRef);
      this._appliedKeys.add(p.key);
      this._pending++;
      set(p, { u: b64FromBytes(u), t: serverTimestamp(), by: this.awareness.clientID })
        .then(() => { this._pending--; if (!this._pending) this.emit("saved", []); })
        .catch(err => { this._pending--; this.emit("error", [err]); });
      this._maybeCompact();
    };

    this._awarenessHandler = ({ added, updated, removed }, origin) => {
      if (this._destroyed) return;
      const my = this.awareness.clientID;
      if (added.concat(updated, removed).includes(my)) this._pushPresence();
    };

    this._start();
  }

  /* ---- mini emisor de eventos (compatible con el uso de y-websocket) ---- */
  on(ev, fn) { (this._events[ev] = this._events[ev] || []).push(fn); }
  once(ev, fn) {
    const wrap = (...a) => { this.offEv(ev, wrap); fn(...a); };
    this.on(ev, wrap);
  }
  offEv(ev, fn) { this._events[ev] = (this._events[ev] || []).filter(f => f !== fn); }
  emit(ev, args) { for (const f of (this._events[ev] || []).slice()) f(...args); }

  async _start() {
    // 1) estado inicial: snapshot + updates existentes
    const [snapSnap, updSnap] = await Promise.all([get(this.snapshotRef), get(this.updatesRef)]);
    if (this._destroyed) return;
    const snapshot = snapSnap.val();
    if (snapshot) {
      try { Y.applyUpdate(this.doc, bytesFromB64(snapshot), this); } catch (e) { console.error(e); }
    }
    const updates = updSnap.val() || {};
    for (const [key, u] of Object.entries(updates)) {
      this._appliedKeys.add(key);
      try { Y.applyUpdate(this.doc, bytesFromB64(u.u), this); } catch (e) { console.error(e); }
    }

    // 2) escuchar updates nuevos
    this._unsubs.push(onChildAdded(this.updatesRef, snap => {
      if (this._appliedKeys.has(snap.key)) return;
      this._appliedKeys.add(snap.key);
      const v = snap.val();
      if (v && v.u) {
        try { Y.applyUpdate(this.doc, bytesFromB64(v.u), this); } catch (e) { console.error(e); }
      }
    }));

    // 3) publicar cambios locales
    this.doc.on("update", this._docUpdateHandler);

    // 4) awareness/presencia
    this.awareness.on("update", this._awarenessHandler);
    this._unsubs.push(onChildAdded(this.presenceRef, s => this._applyPresence(s)));
    this._unsubs.push(onChildChanged(this.presenceRef, s => this._applyPresence(s)));
    this._unsubs.push(onChildRemoved(this.presenceRef, s => {
      const id = parseInt(s.key, 10);
      if (id !== this.awareness.clientID)
        awarenessProtocol.removeAwarenessStates(this.awareness, [id], "remote");
    }));
    onDisconnect(this.myPresenceRef).remove().catch(() => {});
    this._refreshTimer = setInterval(() => this._pushPresence(), AWARENESS_REFRESH);

    // 5) estado de conexión
    const connRef = ref(db, ".info/connected");
    this._unsubs.push(onValue(connRef, snap => {
      const c = !!snap.val();
      if (c) onDisconnect(this.myPresenceRef).remove().catch(() => {});
      this.emit("status", [{ status: c ? "connected" : "disconnected" }]);
      if (c) this._pushPresence();
    }));

    this.synced = true;
    this.emit("synced", [true]);
    this.emit("status", [{ status: "connected" }]);
  }

  _applyPresence(snap) {
    const id = parseInt(snap.key, 10);
    if (id === this.awareness.clientID) return;
    const v = snap.val();
    if (v && v.b64) {
      try { awarenessProtocol.applyAwarenessUpdate(this.awareness, bytesFromB64(v.b64), "remote"); }
      catch (e) { console.error(e); }
    }
  }

  _pushPresence() {
    if (this._destroyed) return;
    const my = this.awareness.clientID;
    if (this.awareness.getLocalState() === null) return;
    const b = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [my]);
    set(this.myPresenceRef, { b64: b64FromBytes(b), t: serverTimestamp() }).catch(() => {});
  }

  async _maybeCompact() {
    if (this.readOnly || this._compacting) return;
    if (this._appliedKeys.size < COMPACT_THRESHOLD) return;
    this._compacting = true;
    try {
      const keys = Array.from(this._appliedKeys);
      const snapshot = b64FromBytes(Y.encodeStateAsUpdate(this.doc));
      const updates = { [`projects/${this.pid}/doc/snapshot`]: snapshot };
      for (const k of keys) updates[`projects/${this.pid}/doc/updates/${k}`] = null;
      await update(ref(db), updates);
      for (const k of keys) this._appliedKeys.delete(k);
    } catch (e) {
      console.error("compact:", e);
    } finally {
      this._compacting = false;
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    clearInterval(this._refreshTimer);
    this.doc.off("update", this._docUpdateHandler);
    this.awareness.off("update", this._awarenessHandler);
    for (const unsub of this._unsubs) { try { unsub(); } catch (e) {} }
    off(this.updatesRef); off(this.presenceRef);
    remove(this.myPresenceRef).catch(() => {});
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.awareness.clientID], "destroy");
    this.awareness.destroy();
  }
}
