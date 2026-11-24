"""Exporta la lámina para redes a PNG (doble resolución: 2160 px de ancho).

Uso (desde la raíz del repo): python lamina/exportar.py
Necesita Playwright con Chromium (pip install playwright && playwright install chromium).
Sale: lamina/salida/eea-catamarca-feed.png (1080×1350 ×2) y lamina/salida/eea-catamarca-historia.png (1080×1920 ×2).
"""
import asyncio, functools, http.server, os, socketserver, threading
from playwright.async_api import async_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FORMATOS = {"feed": (1080, 1350), "historia": (1080, 1920)}

def servir():
    class Silencioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    manejador = functools.partial(Silencioso, directory=RAIZ)
    srv = socketserver.TCPServer(("127.0.0.1", 0), manejador)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def main():
    srv = servir(); puerto = srv.server_address[1]
    os.makedirs(os.path.join(RAIZ, "lamina", "salida"), exist_ok=True)
    async with async_playwright() as p:
        nav = await p.chromium.launch()
        for nombre, (w, h) in FORMATOS.items():
            pag = await nav.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
            errores = []; pag.on("pageerror", lambda e: errores.append(str(e)))
            await pag.goto(f"http://127.0.0.1:{puerto}/lamina/?formato={nombre}")
            await pag.wait_for_function("window.__listo === true", timeout=120000)
            salida = os.path.join(RAIZ, "lamina", "salida", f"eea-catamarca-{nombre}.png")
            await pag.locator("#lamina").screenshot(path=salida)
            print(salida, "errores:", errores or "ninguno")
        await nav.close()
    srv.shutdown()

if __name__ == "__main__":
    asyncio.run(main())
