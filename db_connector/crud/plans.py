import logging
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from db_connector.db_models import TablePlans
from db_connector.db_schemas import PlanCreate, PlanUpdate


logger = logging.getLogger(__name__)


def get_plan(db: Session, plan_id: int) -> Optional[TablePlans]:
    try:
        return db.query(TablePlans).filter(TablePlans.id == plan_id).first()
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения плана %s: %s", plan_id, exc)
        raise


def get_plans_by_user(
    db: Session, user_id: str, skip: int = 0, limit: int = 100
) -> list[type[TablePlans]]:
    try:
        return (
            db.query(TablePlans)
            .filter(TablePlans.user_id == user_id)
            .order_by(TablePlans.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения планов пользователя %s: %s", user_id, exc)
        raise


def get_plans_by_object_id(db: Session, object_id: str) -> list[type[TablePlans]]:
    try:
        return (
            db.query(TablePlans)
            .filter(TablePlans.object_id == object_id)
            .order_by(TablePlans.created_at.desc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.error("Ошибка получения планов по object_id %s: %s", object_id, exc)
        raise


def create_plan(db: Session, plan_data: PlanCreate) -> TablePlans:
    try:
        db_plan = TablePlans(
            user_id=plan_data.user_id,
            object_id=plan_data.object_id,
            raw_plan_path=plan_data.raw_plan_path,
            normalized_plan_path=plan_data.normalized_plan_path,
            vectorized_plan_path=plan_data.vectorized_plan_path,
            vector_npy_path=plan_data.vector_npy_path,
            walls_vector_data=plan_data.walls_vector_data,
            obj_3d_path=plan_data.obj_3d_path,
        )
        db.add(db_plan)
        db.commit()
        db.refresh(db_plan)
        logger.info("План для %s создан", plan_data.object_id)
        return db_plan
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при создании плана: %s", exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при создании плана: %s", exc)
        raise


def update_plan(db: Session, plan_id: int, plan_data: PlanUpdate) -> Optional[TablePlans]:
    try:
        db_plan = get_plan(db, plan_id)
        if not db_plan:
            return None

        update_data = plan_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_plan, key, value)

        db.commit()
        db.refresh(db_plan)
        logger.info("План %s обновлен", plan_id)
        return db_plan
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при обновлении плана %s: %s", plan_id, exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при обновлении плана: %s", exc)
        raise


def delete_plan(db: Session, plan_id: int) -> bool:
    try:
        db_plan = get_plan(db, plan_id)
        if not db_plan:
            return False

        db.delete(db_plan)
        db.commit()
        logger.info("План %s удален", plan_id)
        return True
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Ошибка БД при удалении плана %s: %s", plan_id, exc)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Неожиданная ошибка при удалении плана: %s", exc)
        raise
