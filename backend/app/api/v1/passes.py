from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.errors import NotFoundError
from app.core.rate_limit import client_ip, write_limiter
from app.models import BusPass, PassApplication, User
from app.schemas.schemas import ApplicationOut, BusPassOut, PassApplyIn
from app.services import passes as pass_service
from app.services.audit import log_action
from app.services.serializers import application_out, pass_out

router = APIRouter(prefix="/passes", tags=["passes"])


@router.get("", response_model=list[BusPassOut])
def my_passes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(BusPass).where(BusPass.user_id == user.id).order_by(BusPass.valid_to.desc(), BusPass.id.desc())).all()
    return [pass_out(p) for p in rows]


@router.get("/applications", response_model=list[ApplicationOut])
def my_applications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(PassApplication).where(PassApplication.user_id == user.id).order_by(PassApplication.created_at.desc(), PassApplication.id.desc())
    ).all()
    return [application_out(a) for a in rows]


@router.post("/applications", response_model=ApplicationOut, status_code=201)
def apply(body: PassApplyIn, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    write_limiter.check(f"u:{user.id}")
    app = pass_service.apply_for_pass(db, user, body.pass_type_id, body.declaration)
    log_action(db, user, "pass.apply", "pass_application", app.id, {"pass_type_id": body.pass_type_id}, client_ip(request))
    db.commit()
    return application_out(app)


@router.get("/{pass_id}", response_model=BusPassOut)
def get_pass(pass_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.scalar(select(BusPass).where(BusPass.id == pass_id, BusPass.user_id == user.id))
    if p is None:
        raise NotFoundError("Pass not found")
    return pass_out(p)


@router.post("/{pass_id}/renew", response_model=ApplicationOut, status_code=201)
def renew(pass_id: int, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    write_limiter.check(f"u:{user.id}")
    app = pass_service.renew_pass(db, user, pass_id)
    log_action(db, user, "pass.renew_request", "pass_application", app.id, {"pass_id": pass_id}, client_ip(request))
    db.commit()
    return application_out(app)
