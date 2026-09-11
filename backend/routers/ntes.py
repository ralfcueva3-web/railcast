from fastapi import APIRouter, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.services.ntes_service import NTESService

router = APIRouter(prefix="/ntes", tags=["NTES"])

ntes_service = NTESService()
bearer_scheme = HTTPBearer()

router = APIRouter(
    prefix="/ntes",
    tags=["NTES"]
)

ntes_service = NTESService()


@router.get("/station/{station_code}")
async def get_station_trains(
    station_code: str,
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
):
    try:
        return ntes_service.get_station_trains(
            station_code.upper(),
            hours=4
        )

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"NTES station request failed: {str(e)}"
        )


@router.get("/train/{train_no}")
async def get_train_status(
    train_no: str,
    date: str,
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
):
    try:
        return ntes_service.get_train_status(
            train_no,
            date
        )

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"NTES train request failed: {str(e)}"
        )


@router.get("/train/{train_no}/route")
async def get_train_route(
    train_no: str,
    date: str,
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
):
    try:
        return ntes_service.get_train_route(
            train_no,
            date
        )

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"NTES route request failed: {str(e)}"
        )