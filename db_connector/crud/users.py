import hashlib
import logging
from typing import Optional

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from db_connector.db_models import TableUsers
from db_connector.db_schemas import UserCreate, UserUpdate


logger = logging.getLogger(__name__)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_user(db: Session, user_id: str) -> Optional[TableUsers]:
    try:
        return db.query(TableUsers).filter(TableUsers.user_id == user_id).first()
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения пользователя %s: %s", user_id, exc)
        raise


def get_user_by_email(db: Session, email: str) -> Optional[TableUsers]:
    return get_user(db, email)


def create_user(db: Session, user: UserCreate) -> TableUsers:
    try:
        if get_user(db, user.user_id):
            raise ValueError(f"Пользователь {user.user_id} уже существует")

        hashed_password = _hash_password(user.password)
        db_user = TableUsers(user_id=user.user_id, password=hashed_password)

        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        logger.info("Пользователь %s создан", user.user_id)
        return db_user
    except IntegrityError as exc:
        db.rollback()
        logger.error("Ошибка целостности при создании пользователя: %s", exc)
        raise ValueError(f"Пользователь {user.user_id} уже существует") from exc
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка БД при создании пользователя %s", user.user_id)
        raise
    except Exception:
        db.rollback()
        logger.exception("Неожиданная ошибка при создании пользователя %s", user.user_id)
        raise


def update_user(db: Session, user_id: str, user_data: UserUpdate) -> Optional[TableUsers]:
    try:
        db_user = get_user(db, user_id)
        if not db_user:
            return None

        if user_data.password:
            db_user.password = _hash_password(user_data.password)

        db.commit()
        db.refresh(db_user)

        logger.info("Пользователь %s обновлен", user_id)
        return db_user
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка БД при обновлении пользователя %s", user_id)
        raise
    except Exception:
        db.rollback()
        logger.exception("Неожиданная ошибка при обновлении пользователя %s", user_id)
        raise


def delete_user(db: Session, user_id: str) -> bool:
    try:
        db_user = get_user(db, user_id)
        if not db_user:
            return False

        db.delete(db_user)
        db.commit()

        logger.info("Пользователь %s удален", user_id)
        return True
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Ошибка БД при удалении пользователя %s", user_id)
        raise
    except Exception:
        db.rollback()
        logger.exception("Неожиданная ошибка при удалении пользователя %s", user_id)
        raise


def verify_password(db: Session, user_id: str, password: str) -> bool:
    try:
        db_user = get_user(db, user_id)
        if not db_user:
            return False

        return db_user.password == _hash_password(password)
    except Exception:
        logger.exception("Ошибка при проверке пароля для %s", user_id)
        return False
