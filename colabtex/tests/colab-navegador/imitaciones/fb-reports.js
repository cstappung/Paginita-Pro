export function publishError(r) { (window.__reportes ||= []).push(r); }
export function watchErrors() { return () => {}; }
export async function esAdmin() { return false; }
export async function deleteError() {} export async function clearErrors() {}
export async function sendFeedback(f) { (window.__feedback ||= []).push(f); }
export function watchFeedback() { return () => {}; }
export async function setFeedbackState() {} export async function deleteFeedback() {} export async function readAll() { return {}; }
