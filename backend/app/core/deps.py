import hmac

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.models import User

SESSION_COOKIE = "tf_session"
CSRF_COOKIE = "tf_csrf"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise UnauthorizedError("Not authenticated")
    claims = decode_access_token(token, get_settings().secret_key)
    if claims is None:
        raise UnauthorizedError("Session expired or invalid")
    try:
        user_id = int(claims["sub"])
    except (KeyError, ValueError):
        raise UnauthorizedError("Session expired or invalid")
    # Role and status always come from the database, never from the token.
    user = db.get(User, user_id)
    if user is None or not user.is_active or claims.get("ver") != user.token_version:
        raise UnauthorizedError("Session expired or invalid")
    if request.method not in SAFE_METHODS:
        header = request.headers.get("x-csrf-token", "")
        if not header or not hmac.compare_digest(header, str(claims.get("csrf", ""))):
            raise ForbiddenError("CSRF validation failed")
    request.state.user = user
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise ForbiddenError("Administrator access required")
    return user
