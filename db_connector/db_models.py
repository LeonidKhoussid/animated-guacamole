from datetime import datetime
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy import (Column, Integer, String, Text, DateTime, ForeignKey, Float,
                        Numeric, JSON, Index)


Base = declarative_base()


class TableUsers(Base):
    """ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ"""
    __tablename__ = "table_users"

    user_id = Column(String(255), primary_key=True)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    properties = relationship(
        "TableProperties",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    plans = relationship(
        "TablePlans",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    dialogs = relationship(
        "TableDialog",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    photos = relationship(
        "TablePhoto",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class TableProperties(Base):
    """ТАБЛИЦА ЕГРН"""
    __tablename__ = "table_properties"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        String(255),
        ForeignKey("table_users.user_id", ondelete="CASCADE"),
        nullable=False
    )
    object_id = Column(String(100), nullable=False, unique=True)
    address = Column(Text)
    owner = Column(String(500))
    object_type = Column(String(200))
    reg_date = Column(String(50))

    total_area = Column(Float)
    cadastral_price = Column(Numeric(15, 2))
    floor = Column(Integer)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("TableUsers", back_populates="properties")
    plans = relationship(
        "TablePlans",
        back_populates="property",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_properties_user_id", "user_id"),
        Index("idx_properties_object_id", "object_id"),
    )


class TablePlans(Base):
    """ТАБЛИЦА ПЛАНОВ"""
    __tablename__ = "table_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    object_id = Column(
        String(100),
        ForeignKey("table_properties.object_id", ondelete="CASCADE"),
        nullable=False
    )
    user_id = Column(
        String(255),
        ForeignKey("table_users.user_id", ondelete="CASCADE"),
        nullable=False
    )

    raw_plan_path = Column(Text)
    normalized_plan_path = Column(Text)
    vectorized_plan_path = Column(Text)

    vector_npy_path = Column(Text)
    walls_vector_data = Column(JSON)
    obj_3d_path = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("TableUsers", back_populates="plans")
    property = relationship("TableProperties", back_populates="plans")

    __table_args__ = (
        Index("idx_plans_user_id", "user_id"),
        Index("idx_plans_object_id", "object_id"),
    )


class TableDialog(Base):
    """ТАБЛИЦА LLM-ДИАЛОГОВ"""
    __tablename__ = "table_dialog"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        String(255),
        ForeignKey("table_users.user_id", ondelete="CASCADE"),
        nullable=False
    )
    chat_id = Column(String(100), nullable=False)

    user_audio_raw_path = Column(Text)
    user_audio_clean_path = Column(Text)

    user_text = Column(Text)
    model_text = Column(Text)

    tts_audio_path = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("TableUsers", back_populates="dialogs")

    __table_args__ = (
        Index("idx_dialog_user_id", "user_id"),
        Index("idx_dialog_chat_id", "chat_id"),
        Index("idx_dialog_created_at", "created_at"),
    )


class TablePhoto(Base):
    """ТАБЛИЦА ФОТО И ГЕНЕРАЦИЙ"""
    __tablename__ = "table_photo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        String(255),
        ForeignKey("table_users.user_id", ondelete="CASCADE"),
        nullable=False
    )
    object_id = Column(String(100), nullable=True)

    input_photo_path = Column(Text, nullable=False)

    user_text = Column(Text)
    generated_prompt = Column(Text)

    generated_photo_paths = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("TableUsers", back_populates="photos")

    __table_args__ = (
        Index("idx_photo_user_id", "user_id"),
        Index("idx_photo_object_id", "object_id"),
        Index("idx_photo_created_at", "created_at"),
    )