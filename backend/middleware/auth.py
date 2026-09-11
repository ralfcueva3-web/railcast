import os
import jwt
from datetime import datetime, timezone
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

PUBLIC_PATHS={"/health","/docs","/openapi.json","/redoc","/auth/token"}
class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS or request.method=="OPTIONS":
            return await call_next(request)
        header=request.headers.get("Authorization","")
        if not header.startswith("Bearer "):
            return JSONResponse({"detail":"Missing Bearer token"},status_code=401)
        token=header[7:]
        try:
            payload=jwt.decode(token,os.getenv("JWT_SECRET","change-me"),algorithms=["HS256"])
            if payload.get("exp") and datetime.fromtimestamp(payload["exp"],tz=timezone.utc)<datetime.now(timezone.utc):
                raise jwt.InvalidTokenError("expired")
            request.state.user=payload.get("sub")
        except jwt.PyJWTError:
            return JSONResponse({"detail":"Invalid or expired token"},status_code=401)
        return await call_next(request)
