import os
from typing import Any, Dict, List, Optional
import asyncpg

class DatabaseService:
    def __init__(self) -> None:
        self.pool: Optional[asyncpg.Pool] = None
        self.url = os.getenv("DATABASE_URL", "postgresql://railcast:railcast@localhost:5432/railcast")

    async def connect(self) -> None:
        self.pool = await asyncpg.create_pool(self.url, min_size=1, max_size=10, command_timeout=5)

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()

    async def fetch_stations(self) -> List[Dict[str, Any]]:
        if not self.pool: raise RuntimeError("Database pool is not initialized")
        rows = await self.pool.fetch("SELECT code,name,distance_km,scheduled_arrival,scheduled_departure,platform FROM stations ORDER BY distance_km")
        return [dict(r) for r in rows]

    async def fetch_historical_delays(self, segment: str, limit: int = 500) -> List[Dict[str, Any]]:
        if not self.pool: raise RuntimeError("Database pool is not initialized")
        rows = await self.pool.fetch(
            "SELECT * FROM historical_delays WHERE segment=$1 ORDER BY observed_at DESC LIMIT $2",
            segment, limit
        )
        return [dict(r) for r in rows]

    async def ping(self) -> bool:
        try:
            if not self.pool: return False
            return bool(await self.pool.fetchval("SELECT 1"))
        except Exception:
            return False
