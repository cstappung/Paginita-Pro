// Mini helper para crear DOM sin frameworks.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function fmtTime(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function toast(msg, ms = 2600) {
  const el = h('div', { class: 'toast' }, msg);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, ms);
}

export function starsText(n) {
  return '★'.repeat(Math.min(5, n)) + '☆'.repeat(Math.max(0, 5 - n));
}

// Base de las pantallas: navegación con flechas / mando entre elementos [data-nav]
export class Screen {
  constructor(app) {
    this.app = app;
    this.el = null;
  }
  mount(root) {
    this.el = this.render();
    root.append(this.el);
    this.afterMount?.();
  }
  unmount() {
    this.beforeUnmount?.();
    this.el?.remove();
  }
  navItems() {
    return [...this.el.querySelectorAll('[data-nav]:not([disabled])')].filter((e) => e.offsetParent !== null);
  }
  focusFirst() {
    this.navItems()[0]?.focus();
  }
  // Navegación genérica: arriba/abajo mueve el foco, confirmar hace click
  onNav(action) {
    const items = this.navItems();
    if (!items.length) return;
    let i = items.indexOf(document.activeElement);
    if (action === 'down' || action === 'right') items[(i + 1) % items.length].focus();
    else if (action === 'up' || action === 'left') items[(i - 1 + items.length) % items.length].focus();
    else if (action === 'confirm') {
      if (i < 0) items[0].focus();
      else if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') document.activeElement.click();
    } else if (action === 'back') this.back?.();
  }
}
