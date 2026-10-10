import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { useGame, type Datos } from './store/gameStore'
import { al, avisa } from './store/red'

// Mascotas dentro de Juegos: el cartero (colabtex/src/juegos/mascotas.js) manda los datos de la
// cuenta y el tema del sitio; el juego avisa que está listo y pide las escrituras. Sin PWA, sin
// service worker y sin guardado local de la partida: todo vive en la cuenta.

al('datos', (x: { datos: Datos }) => useGame.getState().recibe(x.datos))
al('tema', (x: { tema: string }) => {
  document.documentElement.dataset.tema = x.tema === 'oscuro' ? 'oscuro' : 'claro'
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
avisa('listo')
