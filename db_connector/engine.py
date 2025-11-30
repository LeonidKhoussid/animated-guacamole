import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from typing import Generator, Optional
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


class AdaptivePool(QueuePool):
    """АДАПТИВНЫЙ ПУЛ СОЕДИНЕНИЙ"""
    
    def __init__(self, creator, pool_size, max_overflow,
                 high_water=0.8, low_water=0.3, adjust_step=2, **kwargs):
        super().__init__(creator, pool_size=pool_size,
                         max_overflow=max_overflow, **kwargs)
        self.high_water = high_water
        self.low_water = low_water
        self.adjust_step = adjust_step
    
    # Рейтинг пула
    def status_ratio(self):
        checked_out = self.checkedout()
        pool_maxsize = self._pool.maxsize if self._pool.maxsize > 0 else 1
        return checked_out / float(pool_maxsize)
    
    # Адаптация overflow
    def _do_get(self):
        ratio = self.status_ratio()
        if ratio > self.high_water:
            self._max_overflow += self.adjust_step
            logger.debug(f"Увеличение max_overflow до {self._max_overflow} (ratio: {ratio:.2f})")
        elif ratio < self.low_water and self._max_overflow >= self.adjust_step:
            self._max_overflow -= self.adjust_step
            logger.debug(f"Уменьшение max_overflow до {self._max_overflow} (ratio: {ratio:.2f})")
        return super()._do_get()


class DatabaseConfig:
    """КОНФИГУРАЦИЯ СОЕДИНЕНИЯ"""
    
    def __init__(self):
        from config import BDConfig
        cfg = BDConfig()
        
        self.db_host = cfg.db_host
        self.db_port = cfg.db_port
        self.db_name = cfg.db_name
        self.db_user = cfg.db_user
        self.db_password = cfg.db_password
        
        self.database_url = (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )
        
        self.echo = False
        self.pool_pre_ping = True
        self.pool_size = 5
        self.max_overflow = 10
        self.pool_timeout = 10


class DBEngineFactory:
    """ИНИЦИАЛИЗАЦИЯ ENGINE"""
    
    def __init__(self, config: Optional[DatabaseConfig] = None, env_var: str = "DB_URL"):
        self.cfg = config or DatabaseConfig()
        self.env_var = env_var
    
    # Получение engine
    def get_engine(self):
        url = os.getenv(self.env_var) or self.cfg.database_url
        return create_engine(
            url,
            poolclass=AdaptivePool,
            pool_size=self.cfg.pool_size,
            max_overflow=self.cfg.max_overflow,
            pool_timeout=self.cfg.pool_timeout,
            pool_pre_ping=self.cfg.pool_pre_ping,
            echo=self.cfg.echo
        )


# Глобальные объекты
db_config = DatabaseConfig()
factory = DBEngineFactory(db_config)
engine = factory.get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Сессия БД
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Инициализация БД
def init_db():
    from db_connector.db_models import Base
    Base.metadata.create_all(bind=engine)


# Очистка БД
def drop_db():
    from db_connector.db_models import Base
    Base.metadata.drop_all(bind=engine)


# # Запуск
# if __name__ == "__main__":
#     db_connector = DBEngineFactory()
#     raw = db_connector.get_engine()
#     logger.info("Всё ок!")
