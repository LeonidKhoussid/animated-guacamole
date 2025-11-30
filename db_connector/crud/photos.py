import logging
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from db_connector.db_models import TablePhoto
from db_connector.db_schemas import PhotoCreate, PhotoUpdate


logger = logging.getLogger(__name__)


def get_photo(db: Session, photo_id: int) -> Optional[TablePhoto]:
    try:
        return db.query(TablePhoto).filter(TablePhoto.id == photo_id).first()
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения фото %s: %s", photo_id, exc)
        raise


def get_photos_by_user(
    db: Session, user_id: str, skip: int = 0, limit: int = 100
) -> list[type[TablePhoto]]:
    try:
        return (
            db.query(TablePhoto)
            .filter(TablePhoto.user_id == user_id)
            .order_by(TablePhoto.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения фото пользователя %s: %s", user_id, exc)
        raise


def get_photos_by_object_id(db: Session, object_id: str) -> list[type[TablePhoto]]:
    try:
        return (
            db.query(TablePhoto)
            .filter(TablePhoto.object_id == object_id)
            .order_by(TablePhoto.created_at.desc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения фото по object_id %s: %s", object_id, exc)
        raise


def create_photo(db: Session, photo_data: PhotoCreate) -> TablePhoto:
    try:
        db_photo = TablePhoto(
            user_id=photo_data.user_id,
            object_id=photo_data.object_id,
            input_photo_path=photo_data.input_photo_path,
            user_text=photo_data.user_text,
            generated_prompt=photo_data.generated_prompt,
            generated_photo_paths=photo_data.generated_photo_paths,
        )
        db.add(db_photo)
        db.commit()
        db.refresh(db_photo)
        logger.info("Фото для пользователя %s создано", photo_data.user_id)
        return db_photo
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при создании фото: %s", exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при создании фото: %s", exc)
        raise


def update_photo(db: Session, photo_id: int, photo_data: PhotoUpdate) -> Optional[TablePhoto]:
    try:
        db_photo = get_photo(db, photo_id)
        if not db_photo:
            return None

        update_data = photo_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_photo, key, value)

        db.commit()
        db.refresh(db_photo)
        logger.info("Фото %s обновлено", photo_id)
        return db_photo
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при обновлении фото %s: %s", photo_id, exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при обновлении фото: %s", exc)
        raise


def delete_photo(db: Session, photo_id: int) -> bool:
    try:
        db_photo = get_photo(db, photo_id)
        if not db_photo:
            return False

        db.delete(db_photo)
        db.commit()
        logger.info("Фото %s удалено", photo_id)
        return True
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при удалении фото %s: %s", photo_id, exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при удалении фото: %s", exc)
        raise
