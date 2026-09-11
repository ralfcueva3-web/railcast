import asyncio
import json
import websockets


async def test_websocket():
    uri = "ws://localhost:8000/live/13028"

    async with websockets.connect(uri) as websocket:
        print("WebSocket connected!\n")

        message = await websocket.recv()

        data = json.loads(message)

        print(json.dumps(data, indent=2))


if __name__ == "__main__":
    asyncio.run(test_websocket())