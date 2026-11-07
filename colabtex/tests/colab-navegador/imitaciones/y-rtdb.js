import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness.js";
export class RtdbProvider {
  constructor(pid, ydoc, { readOnly = false } = {}) {
    this.pid = pid; this.doc = ydoc; (window.__fakeDocs ||= {})[pid] = ydoc; this.readOnly = readOnly; this._events = {};
    this.awareness = new awarenessProtocol.Awareness(ydoc);
    const p = window.__fakeProjects[pid];
    if (p && p.update) Y.applyUpdate(ydoc, p.update, this);
    this._h = (u, origin) => { if (origin !== this && p) { p.update = Y.encodeStateAsUpdate(ydoc); setTimeout(() => this.emit("saved", []), 0); } };
    ydoc.on("update", this._h);
    setTimeout(() => { this.synced = true; this.emit("synced", [true]); this.emit("status", [{ status: "connected" }]); }, 10);
  }
  on(n, f) { (this._events[n] ||= []).push(f); }
  once(n, f) { const g = (...a) => { this.off(n, g); f(...a); }; this.on(n, g); }
  off(n, f) { this._events[n] = (this._events[n] || []).filter(x => x !== f); }
  emit(n, args) { for (const f of (this._events[n] || []).slice()) f(...args); }
  destroy() { this.doc.off("update", this._h); this.awareness.destroy(); }
}
