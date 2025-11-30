import logging
from typing import Optional

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from db_connector.db_models import TableProperties
from db_connector.db_schemas import PropertyCreate, PropertyUpdate


logger = logging.getLogger(__name__)


def get_property(db: Session, property_id: int) -> Optional[TableProperties]:
    try:
        return db.query(TableProperties).filter(TableProperties.id == property_id).first()
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения свойства %s: %s", property_id, exc)
        raise


def get_property_by_object_id(db: Session, object_id: str) -> Optional[TableProperties]:
    try:
        return db.query(TableProperties).filter(
            TableProperties.object_id == object_id
        ).first()
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения свойства по object_id %s: %s", object_id, exc)
        raise


def get_properties_by_user(
    db: Session, user_id: str, skip: int = 0, limit: int = 100
) -> list[type[TableProperties]]:
    try:
        return (
            db.query(TableProperties)
            .filter(TableProperties.user_id == user_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения свойств пользователя %s: %s", user_id, exc)
        raise


def create_property(db: Session, property_data: PropertyCreate) -> TableProperties:
    try:
        if get_property_by_object_id(db, property_data.object_id):
            raise ValueError(
                f"Свойство с кадастровым номером {property_data.object_id} уже существует"
            )

        db_property = TableProperties(
            user_id=property_data.user_id,
            object_id=property_data.object_id,
            address=property_data.address,
            owner=property_data.owner,
            object_type=property_data.object_type,
            reg_date=property_data.reg_date,
            total_area=property_data.total_area,
            cadastral_price=property_data.cadastral_price,
            floor=property_data.floor,
        )
        db.add(db_property)
        db.commit()
        db.refresh(db_property)
        logger.info("Свойство %s создано", property_data.object_id)
        return db_property
    except IntegrityError as exc:
        db.rollback()
        logger.error("Ошибка целостности при создании свойства: %s", exc)
        raise ValueError(
            f"Свойство с кадастровым номером {property_data.object_id} уже существует"
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при создании свойства: %s", exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при создании свойства: %s", exc)
        raise


def update_property(
    db: Session, property_id: int, property_data: PropertyUpdate
) -> Optional[TableProperties]:
    try:
        db_property = get_property(db, property_id)
        if not db_property:
            return None

        update_data = property_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_property, key, value)

        db.commit()
        db.refresh(db_property)
        logger.info("Свойство %s обновлено", property_id)
        return db_property
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при обновлении свойства %s: %s", property_id, exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при обновлении свойства: %s", exc)
        raise


def delete_property(db: Session, property_id: int) -> bool:
    try:
        db_property = get_property(db, property_id)
        if not db_property:
            return False

        db.delete(db_property)
        db.commit()
        logger.info("Свойство %s удалено", property_id)
        return True
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при удалении свойства %s: %s", property_id, exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при удалении свойства: %s", exc)
        raise