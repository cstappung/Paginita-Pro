// Partes del runtime que solo existen en la versión de escritorio, reemplazadas por funciones vacías en la web.
//
// Resumen: el runtime de WiiCompiled trae extras que en el navegador no aplican (o todavía no):
//   - settings_overlay: el menú de opciones que se abre con F10, dibujado con la librería imgui. En la web los
//     ajustes van en la página (HTML), no dentro del juego.
//   - DiscordPresence: mostrar "jugando Mario Kart" en Discord; habla con el programa de Discord del PC.
//   - TLS (conexiones cifradas, network_ssl.cpp, con mbedTLS): solo lo usa el juego en línea, que llega en la fase 6
//     con su propio puente. Mientras tanto cualquier intento de abrir una conexión cifrada falla con un error que
//     el juego entiende ("no se pudo"), igual que sin internet.
#include "discord_presence.h"
#include "settings_overlay.h"
#include "hle/net/network_internal.h"

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

namespace NetworkHle {
void ClearSslSessionsForSocket(uint32_t) {}
NasSslWriteAction PreparePlainNasTcpWrite(WiiSocket&, const uint8_t*, uint32_t, std::vector<uint8_t>&)
{
    return NasSslWriteAction::PassThrough;
}
int32_t HandleSslIoctlv(uint32_t, const std::vector<IoVector>&, const std::vector<IoVector>&)
{
    return -1;  // error genérico de SSL de la Wii: el juego lo trata como "sin conexión"
}
}  // namespace NetworkHle
