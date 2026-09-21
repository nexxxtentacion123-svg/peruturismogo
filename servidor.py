"""Servidor local sencillo para probar PerúTurismo GO.

No gestiona usuarios: el login y el progreso viven en Supabase.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def main():
    server = ThreadingHTTPServer(
        ("127.0.0.1", 8000),
        lambda *args, **kwargs: SimpleHTTPRequestHandler(
            *args, directory=str(ROOT), **kwargs
        ),
    )
    print("PerúTurismo GO: http://localhost:8000")
    print("Cierra esta ventana para detenerlo.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
