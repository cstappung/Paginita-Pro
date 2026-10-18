// Partes del runtime que solo existen en la versión de escritorio, reemplazadas por funciones vacías en la web.
//
// Resumen: el runtime de WiiCompiled trae extras que en el navegador no aplican (o todavía no):
//   - settings_overlay: el menú de opciones que se abre con F10, dibujado con la librería imgui. En la web los
//     ajustes van en la página (HTML), no dentro del juego.
//   - DiscordPresence: mostrar "jugando Mario Kart" en Discord; habla con el programa de Discord del PC.
//   (Las conexiones "cifradas" del juego en línea ya no van aquí: network_ssl.cpp se compila para la web en modo
//    solo texto plano, ver parches/runtime-web.diff y bitácora §58.)
#include "discord_presence.h"
#include "settings_overlay.h"

namespace settings_overlay {
void InitializeRuntimeSettings() noexcept {}
void HandleEvents(const AuroraEvent*) noexcept {}
void Draw() noexcept {}
bool StartupScreenVisible() noexcept { return false; }
void NotifyStrapInputAccepted() noexcept {}
void AdvancePresentedFrame() noexcept {}
void ReleaseControllers() noexcept {}
}  // namespace settings_overlay

namespace DiscordPresence {
void Initialize(const std::string&, const std::string&) {}
void SetClient(const std::string&) {}
void SetActivity(Activity) {}
void Reset() {}
void Shutdown() {}
}  // namespace DiscordPresence
