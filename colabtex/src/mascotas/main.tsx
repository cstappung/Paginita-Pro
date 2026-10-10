import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { Visor } from './ui/Visor'
import { useGame, type Datos } from './store/gameStore'
import { al, avisa } from './store/red'

// Mascotas dentro de Juegos: el cartero (colabtex/src/juegos/mascotas.js) manda los datos de la
// cuenta y el tema del sitio; el juego avisa que está listo y pide las escrituras. Sin PWA, sin
// service worker y sin guardado local de la partida: todo vive en la cuenta.
//
// El mismo paquete sirve de visor (`visor.html`, `<body data-modo="visor">`): fotos y vista en vivo
// de objetos y mascotas para el mercado, el perfil y el salón. Un solo archivo en caché para las dos.

const visor = document.body.dataset.modo === 'visor'

if (!visor) {
  al('datos', (x: { datos: Datos }) => useGame.getState().recibe(x.datos))
  al('tema', (x: { tema: string }) => {
    document.documentElement.dataset.tema = x.tema === 'oscuro' ? 'oscuro' : 'claro'
  })
}

createRoot(document.getElementById('root')!).render(<StrictMode>{visor ? <Visor /> : <App />}</StrictMode>)
if (!visor) avisa('listo')
