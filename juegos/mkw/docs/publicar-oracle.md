# Montar el árbitro de Mario Kart en Oracle Cloud

El servidor recibe los botones y reparte la misma hoja de mandos a todos. Los navegadores siguen corriendo sus doce
karts. El servidor hace de tablero común y la PC de un jugador queda como respaldo. El anfitrión de la sala elige
**Servidor Oracle** en **✎ Cambiar → Conexión**. Si algún piloto presente no llega al servidor al largar, la sala
usa el host y lo avisa. Si el servidor deja de responder durante la carrera, la malla WebRTC de los jugadores
sigue llevando el tráfico necesario para que el host tome el mando.

## 1. Crear la cuenta y la máquina

1. Abre [Oracle Cloud Free Tier](https://www.oracle.com/latam/cloud/free/). Regístrate con tus propios datos y tarjeta
   y configura la verificación de dos pasos. Selecciona **Chile Central (Santiago)**, código `sa-santiago-1`, como
   **región de casa**. La VM Always Free se crea en esa región. Revisa la elección antes de confirmar el alta.
   [Regiones de OCI](https://docs.oracle.com/es-ww/iaas/Content/General/Concepts/regions.htm).
2. En la consola de OCI, entra en **Compute → Instances → Create instance**. Nombre sugerido `mkw-arbitro`. Selecciona
   Ubuntu 24.04 LTS **Arm64** y la forma **VM.Standard.A1.Flex** marcada como **Always Free eligible**. Para empezar,
   selecciona **1 OCPU, 6 GB de RAM** y deja el disco de arranque en su tamaño por omisión. Revisa el consumo conjunto
   con los otros recursos de la cuenta antes de confirmar. [Guía de creación de instancias](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm).
3. Elige una subred pública con ruta a Internet y asigna una IPv4 pública. Sube tu clave **pública** SSH o guarda el
   par que genere OCI. La clave privada queda en tu PC. Anota la IP que aparece cuando la máquina esté **Running**.

**Disponibilidad y facturación.** `Out of host capacity` significa que Oracle no tiene sitio para esa forma en ese
momento. Puedes probar otro dominio de disponibilidad de la misma región si la consola lo ofrece o volver más tarde.
Oracle puede recuperar una VM Always Free si la considera ociosa en una ventana de **7 días**, según su uso de
CPU, red y, en A1, memoria. Pasar a **Pay As You Go** es una opción si necesitas otras condiciones de capacidad y
continuidad. Confirma con Oracle las condiciones aplicables a tu cuenta antes de hacerlo. En PAYG sigue habiendo
recursos gratis dentro de la cuota y se cobra lo que la supera. Revisa CPU-hora, RAM-hora, discos y salida de red
en **Billing & Cost Management**, y configura alertas y cuotas. Una alerta de presupuesto avisa, pero no corta el
consumo. La capa gratuita carece de SLA y de soporte técnico de servicio para cuentas que solo usan Always Free.
Guarda una copia de tu configuración fuera de la máquina. [Cuotas y recuperación por ocio](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) · [Preguntas de cuenta y soporte](https://www.oracle.com/latam/cloud/free/faq/).

## 2. Abrir los puertos y apuntar el dominio

- En la lista de seguridad o grupo de seguridad de red de OCI, agrega entradas TCP **80 y 443** desde
  `0.0.0.0/0`. Usa **22** para SSH desde tu IP pública con máscara `/32`. Si la regla creada por omisión deja el
  22 abierto a todos, sustitúyela por la de tu IP.
- En el panel DNS de tu dominio, crea un registro **A** con la IPv4 de la VM. Usa un subdominio dedicado y deja
  ese registro en modo **solo DNS** si usas el DNS de Cloudflare. En los comandos de ejemplo, sustituye
  `arbitro.example.org` por ese subdominio. Verifica desde el PC con `nslookup arbitro.example.org`.
- Si usas una IP pública efímera y la reemplazas, actualiza el registro DNS. Con IPv4 sola, deja sin registro AAAA
  el subdominio.

Entra desde tu PC con `ssh -i RUTA_A_TU_CLAVE ubuntu@IP_PUBLICA`. En Ubuntu comprueba también el cortafuegos de la
VM con `sudo iptables -L INPUT -n --line-numbers`. Las dos protecciones están en serie. Si la imagen tiene una regla
`REJECT` antes de las reglas para 80/443, inserta una autorización y guárdala para después del reinicio:

```bash
sudo apt update
sudo apt install -y iptables-persistent
sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT
sudo netfilter-persistent save
```

Si el sistema administra el cortafuegos con UFW, usa `sudo ufw allow 80/tcp` y `sudo ufw allow 443/tcp` en ese
sistema. Node escucha solo en la propia VM en el puerto **8443**.

## 3. Instalar Node y el árbitro

En la VM instala Node 24 LTS para ARM64 desde el sitio de Node, y Caddy desde Ubuntu:

```bash
sudo apt update
sudo apt install -y curl ca-certificates xz-utils caddy
mkdir -p ~/node-mkw && cd ~/node-mkw
base=https://nodejs.org/dist/latest-v24.x
curl -fsSLO "$base/SHASUMS256.txt"
archivo=$(awk '$2 ~ /-linux-arm64\.tar\.xz$/ { print $2 }' SHASUMS256.txt)
curl -fsSLO "$base/$archivo"
grep "  $archivo$" SHASUMS256.txt | sha256sum -c && \
  sudo install -d /opt/node-mkw && \
  sudo tar -xJf "$archivo" -C /opt/node-mkw --strip-components=1
/opt/node-mkw/bin/node --version
```

Desde PowerShell en la carpeta del proyecto, envía solo estos dos archivos:

```powershell
scp -i RUTA_A_TU_CLAVE herramientas/arbitro/servidor.mjs web/navegador/lockstep.mjs ubuntu@IP_PUBLICA:
```

De vuelta en la VM, instala los archivos y prepara la configuración privada:

```bash
sudo useradd --system --shell /usr/sbin/nologin mkw-arbitro
sudo install -d /opt/mkw-arbitro
sudo install -m 0644 ~/servidor.mjs ~/lockstep.mjs /opt/mkw-arbitro/
sudo install -m 0600 /dev/null /etc/mkw-arbitro.env
openssl rand -hex 32
sudoedit /etc/mkw-arbitro.env
```

Escribe estas tres líneas en el archivo y sustituye `CLAVE_GENERADA` por la salida de OpenSSL. Guarda una copia en
tu gestor de contraseñas.

```ini
MKW_ARBITRO_HOST=127.0.0.1
MKW_ARBITRO_PUERTO=8443
MKW_ARBITRO_CLAVE=CLAVE_GENERADA
```

## 4. Arranque automático y certificado

Con `sudoedit /etc/systemd/system/mkw-arbitro.service`, escribe:

```ini
[Unit]
Description=Arbitro de Mario Kart
After=network.target

[Service]
User=mkw-arbitro
WorkingDirectory=/opt/mkw-arbitro
EnvironmentFile=/etc/mkw-arbitro.env
ExecStart=/opt/node-mkw/bin/node /opt/mkw-arbitro/servidor.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mkw-arbitro
curl --fail http://127.0.0.1:8443/
```

Con `sudoedit /etc/caddy/Caddyfile` configura el dominio. Conserva las otras configuraciones si ya usas Caddy para
algo más. Caddy obtiene y renueva el certificado de Let's Encrypt y conecta el WebSocket cifrado con Node.

```caddyfile
arbitro.example.org {
    tls {
        ca https://acme-v02.api.letsencrypt.org/directory
    }
    reverse_proxy 127.0.0.1:8443
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl --fail https://arbitro.example.org/
```

El último comando debe responder `ok: árbitro de Mario Kart` seguido del número de salas. Si el certificado falla,
revisa DNS y los dos cortafuegos. Los registros se ven con `sudo journalctl -u caddy -n 80` y
`sudo journalctl -u mkw-arbitro -n 80`. Mantén apagado `MKW_ARBITRO_PRUEBAS` y evita registrar la dirección de
cada WebSocket completa. La conexión lleva la clave en su consulta.
[HTTPS automático de Caddy](https://caddyserver.com/docs/automatic-https) · [Proxy de Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## 5. Autorizar a la sala y comprobar la vuelta al host

Como dueño, crea fuera de git un archivo `arbitro.json` con tu dirección y la misma clave de la VM:

```json
{"url":"wss://arbitro.example.org/","clave":"CLAVE_GENERADA"}
```

Coloca el archivo en el bucket privado del juego con la llave **`mkw/build/arbitro.json`**. La página lo pide por
el Worker de amigos en `/mkw/build/arbitro.json`, como los demás archivos privados. El archivo y la clave se
entregan a los jugadores autorizados, que pueden verlos en su navegador. Trata la clave como una credencial
compartida con esos amigos. Si la cambias, actualiza ambos archivos y reinicia el servicio antes de probar.

Con dos jugadores presentes, elige **Servidor Oracle** y larga una carrera. Debería salir **Árbitro: servidor
Oracle**. Para comprobar el respaldo en una sala de prueba, ejecuta `sudo systemctl stop mkw-arbitro` con la
carrera andando. Revisa que las dos páginas avisen que sigue un host. Luego ejecuta
`sudo systemctl start mkw-arbitro`. El servidor puede volver a elegirse en la próxima carrera cuando todos lo
tengan disponible. Para retirar la opción operativa, puedes quitar el archivo privado. Si el anfitrión elige
Oracle y el archivo falta, la sala avisa y usa el host.
