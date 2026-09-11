from ntes import NTESClient

client = NTESClient(timeout=15, retries=3)

station_code = "NHT"

print(f"\nFetching live trains at {station_code}...\n")

try:
    data = client.station_live(station_code, hours=4)

    print("RAW RESPONSE:")
    print(data)

    trains = data.get("TrainsAtStation", [])

    print(f"\nFound {len(trains)} trains.\n")

    for train in trains:
        print("-" * 60)
        print("Train Number:", train.get("TrainNumber"))
        print("Train Name:", train.get("TrainName"))
        print("ETA:", train.get("ETA"))
        print("ETD:", train.get("ETD"))
        print("Platform:", train.get("Platform"))
        print("Arrival Delay:", train.get("DelayArr"))
        print("Departure Delay:", train.get("DelayDep"))

except Exception as e:
    print("\nNTES ERROR:")
    print(type(e).__name__, str(e))