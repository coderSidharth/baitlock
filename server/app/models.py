"""Import every ORM model so Base.metadata is complete before create_all()."""

from app.features.phishing import models as phishing_models  # noqa: F401
from app.features.fraud import models as fraud_models  # noqa: F401
from app.features.auth import models as auth_models  # noqa: F401
from app.features.chat import models as chat_models  # noqa: F401
from app.features.companies import models as companies_models  # noqa: F401
