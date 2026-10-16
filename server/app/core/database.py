from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings

# Depending on the DB driver, connect_args might need tweaking.
# For SQLite, we need check_same_thread=False
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
poolclass = StaticPool if settings.DATABASE_URL.startswith("sqlite") else None

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args=connect_args,
    poolclass=poolclass
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
