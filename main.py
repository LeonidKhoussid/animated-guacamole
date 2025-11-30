import sys
import time
import logging
import threading
import subprocess
from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from db_connector import init_db
from ml_service.llama_agent import DialogManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class ReplanningAPI:
    """УПРАВЛЕНИЕ API И ML"""

    def __init__(self):
        self.tunnel_process = None
        self.tunnel_url = None
        self.dialog_manager = None

    # Туннель
    def start_tunnel(self, port: int = 8000, use_ngrok: bool = False) -> None:
        try:
            if use_ngrok:
                from pyngrok import ngrok
                public_url = ngrok.connect(port)
                self.tunnel_url = str(public_url)
                logger.info("Ngrok туннель создан: %s", self.tunnel_url)
                return
        except Exception:
            logger.info("Используем localtunnel")

        try:
            self.tunnel_process = subprocess.Popen(
                ["npx", "localtunnel", "--port", str(port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            time.sleep(3)
            if self.tunnel_process.stdout:
                for _ in range(5):
                    line = self.tunnel_process.stdout.readline()
                    if not line:
                        break
                    line_lower = line.lower()
                    if "your url is" in line_lower or "url:" in line_lower:
                        self.tunnel_url = line.split("your url is")[-1].strip() if "your url is" in line_lower else line.split("url:")[-1].strip()
                        logger.info("Localtunnel создан: %s", self.tunnel_url)
                        return
        except Exception:
            logger.info("Localtunnel не удалось запустить")

    # Стоп туннель
    def stop_tunnel(self) -> None:
        if self.tunnel_process:
            self.tunnel_process.terminate()
            self.tunnel_process = None
        if self.tunnel_url:
            try:
                from pyngrok import ngrok
                ngrok.disconnect_all()
            except Exception:
                pass
            self.tunnel_url = None

    # DialogManager
    def start_dialog(self) -> None:
        try:
            self.dialog_manager = DialogManager()
            logger.info("DialogManager инициализирован")
        except Exception as e:
            logger.error("Ошибка DialogManager: %s", e)


api_service = ReplanningAPI()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
    except Exception as e:
        logger.error("Ошибка инициализации БД: %s", e)

    threading.Thread(target=api_service.start_dialog, daemon=True).start()
    yield
    api_service.stop_tunnel()


app = FastAPI(
    title="Replanning API",
    description="API перепланировки квартир с ML",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.include_router(router, prefix="/api", tags=["API"])

# Корень
@app.get("/", response_class=JSONResponse)
async def root():
    return {
        "message": "API запущен",
        "version": "1.0.0",
        "status": "running",
        "dialog_manager": "active",
        "docs": "/docs",
        "redoc": "/redoc",
        "tunnel": api_service.tunnel_url or "not active",
    }

# Проверка здоровья
@app.get("/health", response_class=JSONResponse)
async def health_check():
    return {"status": "healthy", "service": "replanning-api", "dialog_manager": "active"}

# Старт туннеля
@app.post("/tunnel/start")
async def start_tunnel_endpoint(port: int = 8000, use_ngrok: bool = False):
    try:
        api_service.start_tunnel(port, use_ngrok)
        return {"success": True, "url": api_service.tunnel_url}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Стоп туннеля
@app.post("/tunnel/stop")
async def stop_tunnel_endpoint():
    try:
        api_service.stop_tunnel()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Статус туннеля
@app.get("/tunnel/status")
async def tunnel_status():
    return {"active": api_service.tunnel_url is not None, "url": api_service.tunnel_url}

# Ошибки
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("Необработанное исключение: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"success": False, "error": "Внутренняя ошибка сервера"})


if __name__ == "__main__":
    import uvicorn

    port = 8000
    auto_tunnel = "--tunnel" in sys.argv
    use_ngrok = "--ngrok" in sys.argv

    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            port = 8000

    if auto_tunnel:
        api_service.start_tunnel(port, use_ngrok=use_ngrok)

    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, log_level="info")
