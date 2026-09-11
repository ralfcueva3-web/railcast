import os
from datetime import datetime, timezone
from typing import Optional

from redis.asyncio import Redis

from backend.models.schemas import LiveTrainState


class RedisService:
    """
    Redis cache for RailCast live train state.

    Redis is treated as a cache, not as a hard dependency.

    If Redis is unavailable:
        - get_state() returns None
        - set_state() silently fails
        - ping() returns False

    This allows RailCast to continue operating using NTES
    or another fallback source.
    """

    def __init__(self) -> None:

        redis_url = os.getenv(
            "REDIS_URL",
            "redis://localhost:6379/0",
        )

        self.client = Redis.from_url(
            redis_url,
            decode_responses=True,

            # Fail quickly if Redis is unavailable.
            socket_connect_timeout=2,
            socket_timeout=2,

            # Avoid hanging indefinitely.
            retry_on_timeout=False,
        )

        self.ttl = int(
            os.getenv(
                "LIVE_STATE_TTL_SECONDS",
                "300",
            )
        )

    # =========================================================
    # KEY
    # =========================================================

    @staticmethod
    def _state_key(train_no: str) -> str:
        """
        Generate a consistent Redis key.

        Train numbers remain strings so values such as 03030
        are not accidentally converted to 3030.
        """

        normalized = str(train_no).strip()

        return f"train:{normalized}:state"

    # =========================================================
    # GET STATE
    # =========================================================

    async def get_state(
        self,
        train_no: str,
    ) -> Optional[LiveTrainState]:
        """
        Retrieve cached train state.

        Redis failure does NOT break the application.
        """

        try:

            raw = await self.client.get(
                self._state_key(train_no)
            )

            if not raw:
                return None

            return LiveTrainState.model_validate_json(
                raw
            )

        except Exception as error:

            print(
                "RAILCAST REDIS GET ERROR:",
                str(error),
            )

            return None

    # =========================================================
    # SET STATE
    # =========================================================

    async def set_state(
        self,
        state: LiveTrainState,
    ) -> None:
        """
        Store live train state in Redis.

        Redis is only a cache, so a Redis failure should not
        prevent the live application from responding.
        """

        try:

            updated_state = state.model_copy(
                update={
                    "updated_at": datetime.now(
                        timezone.utc
                    )
                }
            )

            payload = (
                updated_state.model_dump_json()
            )

            await self.client.setex(
                self._state_key(
                    updated_state.train_no
                ),
                self.ttl,
                payload,
            )

        except Exception as error:

            print(
                "RAILCAST REDIS SET ERROR:",
                str(error),
            )

    # =========================================================
    # DELETE STATE
    # =========================================================

    async def delete_state(
        self,
        train_no: str,
    ) -> None:
        """
        Delete cached state for a train.

        Useful when forcing a fresh NTES request.
        """

        try:

            await self.client.delete(
                self._state_key(train_no)
            )

        except Exception as error:

            print(
                "RAILCAST REDIS DELETE ERROR:",
                str(error),
            )

    # =========================================================
    # PING
    # =========================================================

    async def ping(self) -> bool:
        """
        Check whether Redis is reachable.
        """

        try:

            return bool(
                await self.client.ping()
            )

        except Exception as error:

            print(
                "RAILCAST REDIS PING ERROR:",
                str(error),
            )

            return False

    # =========================================================
    # CLOSE
    # =========================================================

    async def close(self) -> None:
        """
        Close Redis connection cleanly.
        """

        try:

            await self.client.aclose()

        except Exception as error:

            print(
                "RAILCAST REDIS CLOSE ERROR:",
                str(error),
            )