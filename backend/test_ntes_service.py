from services.ntes_service import NTESService


ntes = NTESService()


print("\n========== NHT LIVE TRAINS ==========\n")

data = ntes.get_station_trains("NHT", hours=4)

print("Station:", data["station_name"])
print("Total trains:", data["total_trains"])

for train in data["trains"]:
    print(
        train["train_no"],
        "|",
        train["train_name"],
        "| ETA:",
        train["eta"],
        "| Platform:",
        train["platform"]
    )


print("\n========== 13028 ROUTE ==========\n")

route_data = ntes.get_train_route(
    "13028",
    "09-Sep-2026"
)

print("Train:", route_data["train_no"])
print("Destination:", route_data["destination"])
print("Current:", route_data["current_station_name"])
print("Delay:", route_data["delay"])
print("Total distance:", route_data["total_distance"])

print("\nStations:")

for station in route_data["route"]:
    print(
        station["station_code"],
        "|",
        station["station_name"],
        "|",
        station["distance"],
        "km"
    )