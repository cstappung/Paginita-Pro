export const conRedireccion = false, app = {}, auth = {}, db = {}, storage = {};
export const AVISO_RECAPTCHA = "";
export function evento() {}
export function esCuentaNueva() { return false; }
export function watchAuth(cb) { setTimeout(() => cb({ uid: "u1", displayName: "Tester", photoURL: "", email: "t@x.y" }), 0); return () => {}; }
export async function loginGoogle() {}
export async function resultadoLogin() { return null; }
export async function logout() {}
