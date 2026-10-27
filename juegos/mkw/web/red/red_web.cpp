// Los sockets del juego van a la página: socket/bind/connect/sendto/recvfrom/poll/getaddrinfo propios — bitácora §58 (F0).
//
// Resumen: la parte de red del runtime (hle/net/network_*.cpp, la "tarjeta de red" de la Wii falsa) usa las
// funciones de red de siempre (las de POSIX: socket, connect, sendto, recvfrom, poll, getaddrinfo…). En el
// navegador no existen de verdad, así que este archivo las DEFINE él mismo y cada una le pasa el pedido a la red de
// juguete de la página (web/navegador/red.mjs, guardada en Module.mkwRed). El enlazador usa estas en vez de las de
// la librería de C de emscripten (que intentarían WebSockets): una función definida en nuestro código gana a la de
// la librería.
//
// Lo único que estas funciones agregan a red.mjs es el "bloqueo": en la página todo es "sin bloqueo" (si no hay
// datos, error EAGAIN), pero el juego a veces pide esperar (un recv bloqueante, poll con tiempo, connect que espera
// a estar conectado). Entonces se espera con JSPI: el juego queda en pausa, la página sigue (llegan los paquetes de
// WebRTC) y al volver se mira otra vez. Las esperas tienen tope (como en la Wii) para que nada quede colgado.
//
// Números: los sockets de la red de juguete empiezan en 0x7000 (no chocan con los archivos abiertos). close() y
// fcntl() NO se reemplazan (los usan también los archivos): el runtime llama a mkw_red_cerrar / mkw_red_bloqueante
// directo (parche en network_core.cpp).
#include <emscripten.h>

#include <arpa/inet.h>
#include <cerrno>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <netdb.h>
#include <netinet/in.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unordered_map>

namespace {

constexpr int kPrimerFd = 0x7000;
// El "tope" de las esperas: recv bloqueante sin SO_RCVTIMEO, connect bloqueante, poll infinito (en ms)
constexpr int kTopeEspera = 15000;

// Lo que la página no sabe y el C++ sí: si el socket bloquea y cuánto espera recv (SO_RCVTIMEO)
struct Extra {
    bool bloqueante = false;    // los del runtime nacen bloqueantes y él los pone "sin bloqueo" enseguida
    int esperaRecvMs = 0;       // 0 = sin tope propio (se usa kTopeEspera)
};
std::unordered_map<int, Extra> g_extra;

// Los errores de red.mjs (ERR) → errno de C
int Errno(int codigo) {
    switch (codigo) {
    case 1: return EAGAIN;
    case 2: return EINPROGRESS;
    case 3: return EALREADY;
    case 4: return EISCONN;
    case 5: return ENOTCONN;
    case 6: return ECONNREFUSED;
    case 7: return ECONNRESET;
    case 8: return EADDRINUSE;
    case 9: return EBADF;
    case 10: return EINVAL;
    case 11: return ENETUNREACH;
    case 12: return EMFILE;
    case 13: return ETIMEDOUT;
    case 14: return EPIPE;
    case 15: return ENOPROTOOPT;
    default: return EIO;
    }
}
// resultado de red.mjs: ≥ 0 se devuelve tal cual; negativo = error → errno y -1 (como POSIX)
int Resultado(int r) {
    if (r >= 0) return r;
    errno = Errno(-r);
    return -1;
}
bool EsNuestro(int fd) { return fd >= kPrimerFd && g_extra.count(fd); }

}  // namespace

// ---- el puente con red.mjs (Module.mkwRed). Sin red en la página: todo falla con "red inalcanzable" ----
EM_JS(int, mkw_red_hay, (), { return Module.mkwRed ? 1 : 0; });
EM_JS(int, mkw_red_socket, (int tipo), { return Module.mkwRed.socket(tipo); });
EM_JS(int, mkw_red_bind, (int fd, uint32_t ip, int puerto), { return Module.mkwRed.bind(fd, ip >>> 0, puerto); });
EM_JS(int, mkw_red_connect, (int fd, uint32_t ip, int puerto), { return Module.mkwRed.connect(fd, ip >>> 0, puerto); });
EM_JS(int, mkw_red_listen, (int fd), { return Module.mkwRed.listen(fd); });
EM_JS(int, mkw_red_accept, (int fd, uint32_t* ip, uint16_t* puerto), {
    const a = Module.mkwRed.accept(fd);
    if (a.r >= 0) { HEAPU32[ip >> 2] = a.ip >>> 0; HEAPU16[puerto >> 1] = a.puerto; }
    return a.r;
});
EM_JS(int, mkw_red_enviar, (int fd, const uint8_t* datos, int n, uint32_t ip, int puerto), {
    // copia: la red de juguete guarda los bytes, y la memoria del juego cambia
    return Module.mkwRed.enviar(fd, HEAPU8.slice(datos, datos + n), ip >>> 0, puerto);
});
EM_JS(int, mkw_red_recibir, (int fd, uint8_t* destino, int cap, int mirar, uint32_t* ip, uint16_t* puerto), {
    const r = Module.mkwRed.recibir(fd, cap, !!mirar);
    if (r.r > 0) HEAPU8.set(r.datos, destino);
    if (r.r >= 0 && ip) { HEAPU32[ip >> 2] = (r.ip || 0) >>> 0; HEAPU16[puerto >> 1] = r.puerto || 0; }
    return r.r;
});
EM_JS(int, mkw_red_listo, (int fd), { return Module.mkwRed.listo(fd); });
EM_JS(int, mkw_red_error, (int fd), { return Module.mkwRed.error(fd); });
EM_JS(int, mkw_red_tipo, (int fd), { return Module.mkwRed.tipo(fd); });
EM_JS(int, mkw_red_nombre, (int fd, int par, uint32_t* ip, uint16_t* puerto), {
    const n = par ? Module.mkwRed.par(fd) : Module.mkwRed.nombre(fd);
    if (!n) return -5;     // ERR.NOTCONN
    HEAPU32[ip >> 2] = n.ip >>> 0; HEAPU16[puerto >> 1] = n.puerto;
    return 0;
});
EM_JS(int, mkw_red_cortar, (int fd, int como), { return Module.mkwRed.cortar(fd, como); });
EM_JS(int, mkw_red_cerrar_js, (int fd), { return Module.mkwRed.cerrar(fd); });
EM_JS_DEPS(mkw_red, "$UTF8ToString");
EM_JS(uint32_t, mkw_red_dns, (const char* nombre), { return Module.mkwRed ? Module.mkwRed.dns(UTF8ToString(nombre)) >>> 0 : 0; });
// la espera: el juego se pausa (JSPI) hasta que la red de juguete cambie algo o pasen ms
EM_ASYNC_JS(void, mkw_red_esperar, (int ms), { await Module.mkwRed.esperar(ms); });

namespace {

// Espera hasta que el socket tenga alguno de los bits `quiere` (LEER=1, ESCRIBIR=4, FALLO=8, CORTE=16) o pase ms
int EsperarListo(int fd, int quiere, int ms) {
    const double fin = emscripten_get_now() + ms;
    for (;;) {
        const int l = mkw_red_listo(fd);
        if (l & (quiere | 8 | 16)) return l;
        const double falta = fin - emscripten_get_now();
        if (falta <= 0) return 0;
        mkw_red_esperar(static_cast<int>(falta) + 1);
    }
}
bool LeerDireccion(const sockaddr* a, socklen_t n, uint32_t& ip, int& puerto) {
    if (!a || n < static_cast<socklen_t>(sizeof(sockaddr_in)) || a->sa_family != AF_INET) return false;
    const auto* in = reinterpret_cast<const sockaddr_in*>(a);
    ip = ntohl(in->sin_addr.s_addr);
    puerto = ntohs(in->sin_port);
    return true;
}
void EscribirDireccion(sockaddr* a, socklen_t* n, uint32_t ip, uint16_t puerto) {
    if (!a || !n) return;
    sockaddr_in in{};
    in.sin_family = AF_INET;
    in.sin_port = htons(puerto);
    in.sin_addr.s_addr = htonl(ip);
    std::memcpy(a, &in, std::min<size_t>(*n, sizeof(in)));
    *n = sizeof(in);
}

}  // namespace

// ---- lo que el runtime llama directo (parche en network_core.cpp) ----
extern "C" int mkw_red_cerrar(int fd) {
    if (!EsNuestro(fd)) return 0;
    g_extra.erase(fd);
    return Resultado(mkw_red_cerrar_js(fd));
}
extern "C" void mkw_red_bloqueante(int fd, bool bloquea) {
    if (EsNuestro(fd)) g_extra[fd].bloqueante = bloquea;
}

// ---- las funciones de red de POSIX (C), con las mismas firmas que <sys/socket.h> ----
extern "C" {

int socket(int dominio, int tipo, int protocolo) {
    (void)protocolo;
    if (!mkw_red_hay()) { errno = ENETDOWN; return -1; }
    if (dominio != AF_INET) { errno = EAFNOSUPPORT; return -1; }
    const int base = tipo & ~(SOCK_NONBLOCK | SOCK_CLOEXEC);
    if (base != SOCK_STREAM && base != SOCK_DGRAM) { errno = EPROTONOSUPPORT; return -1; }
    const int fd = mkw_red_socket(base == SOCK_STREAM ? 1 : 2);
    if (fd < 0) return Resultado(fd);
    g_extra[fd].bloqueante = (tipo & SOCK_NONBLOCK) == 0;
    return fd;
}

int bind(int fd, const sockaddr* a, socklen_t n) {
    uint32_t ip = 0; int puerto = 0;
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    if (!LeerDireccion(a, n, ip, puerto)) { errno = EINVAL; return -1; }
    return Resultado(mkw_red_bind(fd, ip, puerto));
}

int connect(int fd, const sockaddr* a, socklen_t n) {
    uint32_t ip = 0; int puerto = 0;
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    if (!LeerDireccion(a, n, ip, puerto)) { errno = EINVAL; return -1; }
    const int r = mkw_red_connect(fd, ip, puerto);
    if (r != -2 || !g_extra[fd].bloqueante) return Resultado(r);    // sin bloqueo: "en camino" (EINPROGRESS)
    // bloqueante: esperar a que se conecte o falle
    if (!EsperarListo(fd, 4, kTopeEspera)) { errno = ETIMEDOUT; return -1; }
    const int e = mkw_red_error(fd);
    if (e) { errno = Errno(e); return -1; }
    return 0;
}

int listen(int fd, int cola) {
    (void)cola;
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    return Resultado(mkw_red_listen(fd));
}

int accept4(int fd, sockaddr* a, socklen_t* n, int banderas) {
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    uint32_t ip = 0; uint16_t puerto = 0;
    int r = mkw_red_accept(fd, &ip, &puerto);
    if (r == -1 && g_extra[fd].bloqueante && EsperarListo(fd, 1, kTopeEspera)) r = mkw_red_accept(fd, &ip, &puerto);
    if (r < 0) return Resultado(r);
    g_extra[r].bloqueante = (banderas & SOCK_NONBLOCK) == 0;
    EscribirDireccion(a, n, ip, puerto);
    return r;
}
int accept(int fd, sockaddr* a, socklen_t* n) { return accept4(fd, a, n, 0); }

int shutdown(int fd, int como) {
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    return Resultado(mkw_red_cortar(fd, como));
}

int getsockname(int fd, sockaddr* a, socklen_t* n) {
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    uint32_t ip = 0; uint16_t puerto = 0;
    const int r = mkw_red_nombre(fd, 0, &ip, &puerto);
    if (r < 0) return Resultado(r);
    EscribirDireccion(a, n, ip, puerto);
    return 0;
}
int getpeername(int fd, sockaddr* a, socklen_t* n) {
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    uint32_t ip = 0; uint16_t puerto = 0;
    const int r = mkw_red_nombre(fd, 1, &ip, &puerto);
    if (r < 0) return Resultado(r);
    EscribirDireccion(a, n, ip, puerto);
    return 0;
}

// Opciones: casi todas se aceptan y no hacen nada (en la red de juguete no hay buffers ni Nagle). Las que importan:
// SO_RCVTIMEO (cuánto espera un recv bloqueante), SO_ERROR (cómo terminó un connect) y SO_TYPE
int setsockopt(int fd, int nivel, int nombre, const void* valor, socklen_t n) {
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    if (nivel == SOL_SOCKET && nombre == SO_RCVTIMEO && valor && n >= static_cast<socklen_t>(sizeof(timeval))) {
        const auto* t = static_cast<const timeval*>(valor);
        g_extra[fd].esperaRecvMs = static_cast<int>(t->tv_sec * 1000 + t->tv_usec / 1000);
    }
    return 0;
}
int getsockopt(int fd, int nivel, int nombre, void* valor, socklen_t* n) {
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    if (!valor || !n || *n < static_cast<socklen_t>(sizeof(int))) { errno = EINVAL; return -1; }
    int v = 0;
    if (nivel == SOL_SOCKET && nombre == SO_ERROR) {
        const int e = mkw_red_error(fd);
        v = e ? Errno(e) : 0;
    } else if (nivel == SOL_SOCKET && nombre == SO_TYPE) {
        v = mkw_red_tipo(fd) == 1 ? SOCK_STREAM : SOCK_DGRAM;
    }
    std::memcpy(valor, &v, sizeof(int));
    *n = sizeof(int);
    return 0;
}

ssize_t sendto(int fd, const void* datos, size_t n, int banderas, const sockaddr* a, socklen_t an) {
    (void)banderas;
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    uint32_t ip = 0; int puerto = 0;
    if (a && !LeerDireccion(a, an, ip, puerto)) { errno = EINVAL; return -1; }
    int r = mkw_red_enviar(fd, static_cast<const uint8_t*>(datos), static_cast<int>(n), ip, puerto);
    // un TCP que todavía se está conectando: si bloquea, esperar a que se conecte y mandar
    if (r == -1 && g_extra[fd].bloqueante && EsperarListo(fd, 4, kTopeEspera))
        r = mkw_red_enviar(fd, static_cast<const uint8_t*>(datos), static_cast<int>(n), ip, puerto);
    return Resultado(r);
}
ssize_t send(int fd, const void* datos, size_t n, int banderas) { return sendto(fd, datos, n, banderas, nullptr, 0); }

ssize_t recvfrom(int fd, void* destino, size_t cap, int banderas, sockaddr* a, socklen_t* an) {
    if (!EsNuestro(fd)) { errno = EBADF; return -1; }
    const bool mirar = (banderas & MSG_PEEK) != 0;
    const bool sinBloqueo = (banderas & MSG_DONTWAIT) != 0 || !g_extra[fd].bloqueante;
    uint32_t ip = 0; uint16_t puerto = 0;
    int r = mkw_red_recibir(fd, static_cast<uint8_t*>(destino), static_cast<int>(cap), mirar, &ip, &puerto);
    if (r == -1 && !sinBloqueo) {
        const int ms = g_extra[fd].esperaRecvMs > 0 ? g_extra[fd].esperaRecvMs : kTopeEspera;
        if (EsperarListo(fd, 1, ms))
            r = mkw_red_recibir(fd, static_cast<uint8_t*>(destino), static_cast<int>(cap), mirar, &ip, &puerto);
    }
    if (r >= 0) EscribirDireccion(a, an, ip, puerto);
    return Resultado(r);
}
ssize_t recv(int fd, void* destino, size_t cap, int banderas) { return recvfrom(fd, destino, cap, banderas, nullptr, nullptr); }

// poll: mira todos; si nadie está listo y hay tiempo, espera a que cambie algo y vuelve a mirar. Los descriptores
// que no son de la red (archivos) se dan por listos, como hace emscripten con los archivos.
int poll(pollfd* fds, nfds_t n, int ms) {
    const double fin = emscripten_get_now() + (ms < 0 ? kTopeEspera : ms);
    for (;;) {
        int listos = 0;
        for (nfds_t i = 0; i < n; ++i) {
            pollfd& p = fds[i];
            p.revents = 0;
            if (p.fd < 0) continue;
            if (!EsNuestro(p.fd)) {
                p.revents = p.fd >= kPrimerFd ? POLLNVAL : static_cast<short>(p.events & (POLLIN | POLLOUT));
            } else {
                const int l = mkw_red_listo(p.fd);
                if (l & 1) p.revents |= p.events & (POLLIN | POLLRDNORM);
                if (l & 4) p.revents |= p.events & (POLLOUT | POLLWRNORM);
                if (l & 8) p.revents |= POLLERR;
                if (l & 16) p.revents |= POLLHUP;
            }
            if (p.revents) ++listos;
        }
        if (listos || ms == 0) return listos;
        const double falta = fin - emscripten_get_now();
        if (falta <= 0) return 0;
        mkw_red_esperar(static_cast<int>(falta) + 1);
    }
}

// DNS: el nombre lo resuelve la página (red.mjs: tabla de la sala). Solo IPv4, una dirección por nombre
int getaddrinfo(const char* nodo, const char* servicio, const addrinfo* pistas, addrinfo** res) {
    if (!res) return EAI_FAIL;
    *res = nullptr;
    if (pistas && pistas->ai_family != AF_UNSPEC && pistas->ai_family != AF_INET) return EAI_FAMILY;
    uint32_t ip = 0;
    if (!nodo) ip = (pistas && (pistas->ai_flags & AI_PASSIVE)) ? INADDR_ANY : INADDR_LOOPBACK;
    else if (!mkw_red_hay()) return EAI_AGAIN;
    else if (!(ip = mkw_red_dns(nodo))) return EAI_NONAME;
    const int puerto = servicio ? std::atoi(servicio) : 0;
    auto* bloque = static_cast<char*>(std::calloc(1, sizeof(addrinfo) + sizeof(sockaddr_in)));
    if (!bloque) return EAI_MEMORY;
    auto* ai = reinterpret_cast<addrinfo*>(bloque);
    auto* sa = reinterpret_cast<sockaddr_in*>(bloque + sizeof(addrinfo));
    sa->sin_family = AF_INET;
    sa->sin_port = htons(static_cast<uint16_t>(puerto));
    sa->sin_addr.s_addr = htonl(ip);
    ai->ai_family = AF_INET;
    ai->ai_socktype = pistas && pistas->ai_socktype ? pistas->ai_socktype : SOCK_STREAM;
    ai->ai_protocol = pistas ? pistas->ai_protocol : 0;
    ai->ai_addrlen = sizeof(sockaddr_in);
    ai->ai_addr = reinterpret_cast<sockaddr*>(sa);
    *res = ai;
    return 0;
}
void freeaddrinfo(addrinfo* ai) {
    while (ai) {                         // cada nodo es un solo bloque (addrinfo + su dirección)
        addrinfo* siguiente = ai->ai_next;
        std::free(ai);
        ai = siguiente;
    }
}

}  // extern "C"
