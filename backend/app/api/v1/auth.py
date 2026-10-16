from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import CSRF_COOKIE, SESSION_COOKIE, get_current_user
from app.core.errors import ConflictError, UnauthorizedError, UnprocessableError
from app.core.rate_limit import client_ip, login_limiter, register_limiter
from app.core.security import (
    burn_password_check,
    create_access_token,
    hash_password,
    needs_rehash,
    new_csrf_token,
    verify_password,
)
from app.models import User
from app.schemas.schemas import ChangePasswordIn, LoginIn, MessageOut, ProfileUpdateIn, RegisterIn, UserOut
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session(response: Response, user: User) -> None:
    s = get_settings()
    csrf = new_csrf_token()
    token = create_access_token(
        user_id=user.id,
        token_version=user.token_version,
        csrf=csrf,
        minutes=s.access_token_minutes,
        secret=s.secret_key,
    )
    max_age = s.access_token_minutes * 60
    response.set_cookie(
        SESSION_COOKIE, token, max_age=max_age, httponly=True, secure=s.cookie_secure, samesite="lax", path="/"
    )
    # Readable by the SPA so it can echo it in the X-CSRF-Token header.
    response.set_cookie(
        CSRF_COOKIE, csrf, max_age=max_age, httponly=False, secure=s.cookie_secure, samesite="lax", path="/"
    )


def _clear_session(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    register_limiter.check(client_ip(request))
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise ConflictError("An account with this email already exists")
    user = User(email=email, full_name=body.full_name, phone=body.phone, password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    log_action(db, user, "auth.register", "user", user.id, ip=client_ip(request))
    db.commit()
    _set_session(response, user)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = client_ip(request)
    email = body.email.lower()
    login_limiter.check(ip)
    login_limiter.check(f"email:{email}")
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        burn_password_check(body.password)
        raise UnauthorizedError("Invalid email or password")
    if not verify_password(user.password_hash, body.password) or not user.is_active:
        raise UnauthorizedError("Invalid email or password")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
        db.commit()
    _set_session(response, user)
    return user


@router.post("/logout", response_model=MessageOut)
def logout(response: Response):
    _clear_session(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(body: ProfileUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "full_name" in data and data["full_name"]:
        user.full_name = data["full_name"]
    if "phone" in data:
        user.phone = data["phone"]
    db.commit()
    return user


@router.post("/change-password", response_model=MessageOut)
def change_password(
    body: ChangePasswordIn,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    login_limiter.check(f"pw:{user.id}")
    if not verify_password(user.password_hash, body.current_password):
        raise UnprocessableError("Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1  # invalidates every other session
    log_action(db, user, "auth.change_password", "user", user.id, ip=client_ip(request))
    db.commit()
    _set_session(response, user)
    return {"message": "Password updated. Other sessions were signed out."}
