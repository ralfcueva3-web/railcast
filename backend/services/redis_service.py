import json
import os
from datetime import datetime, timezone
from typing import Optional
from redis.asyncio import Redis
from backend.models.schemas import LiveTrainState

class RedisService:
    def __init__(self) -> None:
        self.client = Redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        self.ttl = int(os.getenv("LIVE_STATE_TTL_SECONDS", "300"))

    async def get_state(self, train_no: int) -> Optional[LiveTrainState]:
        raw = await self.client.get(f"train:{train_no}:state")
        return LiveTrainState.model_validate_json(raw) if raw else None

    async def set_state(self, state: LiveTrainState) -> None:
        payload = state.model_copy(update={"updated_at": datetime.now(timezone.utc)}).model_dump_json()
        await self.client.setex(f"train:{state.train_no}:state", self.ttl, payload)

    async def ping(self) -> bool:
        try:
            return bool(await self.client.ping())
        except Exception:
            return False

    async def close(self) -> None:
        await self.client.aclose()
