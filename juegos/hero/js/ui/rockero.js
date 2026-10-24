// «Tu rockero»: el editor de Batalla de Rock en la entrada del juego.
// La escena 3D ocupa la pantalla y el panel del editor va encima (js/rock/escena.js); las cajas,
// guardar y vender se le piden a la página (sitio/rock.js).
import { h, Screen, toast } from './dom.js';
import { rockSitio, cargaEscena, pideRock } from '../sitio/rock.js';

export class RockeroScreen extends Screen {
  render() {
    this.host = h('div', { class: 'rock-host' });
    this.estado = h('div', { class: 'rock-cargando' }, 'Montando el escenario…');
    return h('div', { class: 'screen rockero' }, this.host, this.estado);
  }

  afterMount() {
    this.app.menuBg.stop();
    this.app.preview?.stop?.();
    cargaEscena().then((rock) => {
      if (!this.el?.isConnected) return;
      this.rock = rock;
      this.estado.remove();
      rock.monta(this.host);
      if (rockSitio.inv) rock.inventario(rockSitio.inv);
      rock.editor(rockSitio.look, {
        abreCaja: (b) => pideRock('caja', { b }),
        guarda: async (look) => {
          const l = await pideRock('guarda', { look });
          rockSitio.look = l || look;
        },
        vende: (c, p) => pideRock('vende', { c, p }),
        mercado: () => pideRock('mercado').catch(() => {}),
        cerrar: () => this.back(),
      });
    }, (err) => {
      console.error(err);
      this.estado.textContent = 'No se pudo cargar el escenario 3D.';
      toast('No se pudo cargar Batalla de Rock', 4000);
      setTimeout(() => this.back(), 1500);
    });
  }

  beforeUnmount() {
    this.rock?.desmonta();
  }

  // el editor se maneja con el ratón; las teclas son para escribir el nombre
  onInput() {
    return true;
  }

  back() {
    this.app.goMenu();
  }
}
