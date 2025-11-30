import logging
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from db_connector.db_models import TableDialog
from db_connector.db_schemas import DialogCreate, DialogUpdate


logger = logging.getLogger(__name__)


def get_dialog(db: Session, dialog_id: int) -> Optional[TableDialog]:
    try:
        return db.query(TableDialog).filter(TableDialog.id == dialog_id).first()
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения диалога %s: %s", dialog_id, exc)
        raise


def get_dialogs_by_user(
    db: Session, user_id: str, skip: int = 0, limit: int = 100
) -> list[type[TableDialog]]:
    try:
        return (
            db.query(TableDialog)
            .filter(TableDialog.user_id == user_id)
            .order_by(TableDialog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения диалогов пользователя %s: %s", user_id, exc)
        raise


def get_dialogs_by_chat_id(
    db: Session, chat_id: str, skip: int = 0, limit: int = 100
) -> list[type[TableDialog]]:
    try:
        return (
            db.query(TableDialog)
            .filter(TableDialog.chat_id == chat_id)
            .order_by(TableDialog.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения диалогов по chat_id %s: %s", chat_id, exc)
        raise


def create_dialog(db: Session, dialog_data: DialogCreate) -> TableDialog:
    try:
        db_dialog = TableDialog(
            user_id=dialog_data.user_id,
            chat_id=dialog_data.chat_id,
            user_audio_raw_path=dialog_data.user_audio_raw_path,
            user_audio_clean_path=dialog_data.user_audio_clean_path,
            user_text=dialog_data.user_text,
            model_text=dialog_data.model_text,
            tts_audio_path=dialog_data.tts_audio_path,
        )
        db.add(db_dialog)
        db.commit()
        db.refresh(db_dialog)
        logger.info("Диалог %s создан", dialog_data.chat_id)
        return db_dialog
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при создании диалога: %s", exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при создании диалога: %s", exc)
        raise


def update_dialog(db: Session, dialog_id: int, dialog_data: DialogUpdate) -> Optional[TableDialog]:
    try:
        db_dialog = get_dialog(db, dialog_id)
        if not db_dialog:
            return None

        update_data = dialog_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_dialog, key, value)

        db.commit()
        db.refresh(db_dialog)
        logger.info("Диалог %s обновлен", dialog_id)
        return db_dialog
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при обновлении диалога %s: %s", dialog_id, exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при обновлении диалога: %s", exc)
        raise


def delete_dialog(db: Session, dialog_id: int) -> bool:
    try:
        db_dialog = get_dialog(db, dialog_id)
        if not db_dialog:
            return False

        db.delete(db_dialog)
        db.commit()
        logger.info("Диалог %s удален", dialog_id)
        return True
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при удалении диалога %s: %s", dialog_id, exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при удалении диалога: %s", exc)
        raise
