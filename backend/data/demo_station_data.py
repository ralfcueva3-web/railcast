from datetime import datetime, timezone


def get_demo_station_data(station_code: str):
    """
    Demo fallback data for RailCast.

    IMPORTANT:
    This data is explicitly marked as DEMO_FALLBACK.
    It must never be presented as live NTES information.
    """

    station_code = (
        str(station_code)
        .strip()
        .upper()
    )

    demo_stations = {
        "RPH": {
            "station": "RPH",
            "station_name": "RAMPURHAT JN",

            "total_trains": 4,

            "trains": [
                {
                    "train_no": "12042",
                    "train_name": "SHATABDI EXP",

                    "source": "NJP",
                    "source_name": "NEW JALPAIGURI",

                    "destination": "HWH",
                    "destination_name": "HOWRAH JN",

                    "eta": "13:47",
                    "etd": "13:50",

                    "scheduled_arrival": "13:45",
                    "scheduled_departure": "13:48",

                    "platform": 1,

                    "arrival_delay": 2,
                    "departure_delay": 2,

                    "cancelled": 0,
                    "diverted": 0,

                    "train_type": "SHATABDI",
                },

                {
                    "train_no": "13028",
                    "train_name": "KAVIGURU EXP",

                    "source": "AZ",
                    "source_name": "AZIMGANJ",

                    "destination": "HWH",
                    "destination_name": "HOWRAH JN",

                    "eta": "14:18",
                    "etd": "14:20",

                    "scheduled_arrival": "14:10",
                    "scheduled_departure": "14:12",

                    "platform": 2,

                    "arrival_delay": 8,
                    "departure_delay": 8,

                    "cancelled": 0,
                    "diverted": 0,

                    "train_type": "EXPRESS",
                },

                {
                    "train_no": "60363",
                    "train_name": "RAMPURHAT LOCAL",

                    "source": "HWH",
                    "source_name": "HOWRAH JN",

                    "destination": "RPH",
                    "destination_name": "RAMPURHAT JN",

                    "eta": "14:32",
                    "etd": "14:35",

                    "scheduled_arrival": "14:30",
                    "scheduled_departure": "14:33",

                    "platform": 3,

                    "arrival_delay": 2,
                    "departure_delay": 2,

                    "cancelled": 0,
                    "diverted": 0,

                    "train_type": "LOCAL",
                },

                {
                    "train_no": "03030",
                    "train_name": "SPECIAL",

                    "source": "RPH",
                    "source_name": "RAMPURHAT JN",

                    "destination": "HWH",
                    "destination_name": "HOWRAH JN",

                    "eta": "15:05",
                    "etd": "15:08",

                    "scheduled_arrival": "15:00",
                    "scheduled_departure": "15:03",

                    "platform": 4,

                    "arrival_delay": 5,
                    "departure_delay": 5,

                    "cancelled": 0,
                    "diverted": 0,

                    "train_type": "SPECIAL",
                },
            ],
        },

        "HWH": {
            "station": "HWH",
            "station_name": "HOWRAH JN",

            "total_trains": 3,

            "trains": [
                {
                    "train_no": "12042",
                    "train_name": "SHATABDI EXP",

                    "source": "NJP",
                    "source_name": "NEW JALPAIGURI",

                    "destination": "HWH",
                    "destination_name": "HOWRAH JN",

                    "eta": "13:47",
                    "etd": "13:50",

                    "scheduled_arrival": "13:45",
                    "scheduled_departure": "13:48",

                    "platform": 11,

                    "arrival_delay": 2,
                    "departure_delay": 2,

                    "cancelled": 0,
                    "diverted": 0,

                    "train_type": "SHATABDI",
                },

                {
                    "train_no": "13028",
                    "train_name": "KAVIGURU EXP",

                    "source": "AZ",
                    "source_name": "AZIMGANJ",

                    "destination": "HWH",
                    "destination_name": "HOWRAH JN",

                    "eta": "14:20",
                    "etd": "14:25",

                    "scheduled_arrival": "14:12",
                    "scheduled_departure": "14:15",

                    "platform": 9,

                    "arrival_delay": 8,
                    "departure_delay": 10,

                    "cancelled": 0,
                    "diverted": 0,

                    "train_type": "EXPRESS",
                },

                {
                    "train_no": "03030",
                    "train_name": "SPECIAL",

                    "source": "RPH",
                    "source_name": "RAMPURHAT JN",

                    "destination": "HWH",
                    "destination_name": "HOWRAH JN",

                    "eta": "15:05",
                    "etd": "15:10",

                    "scheduled_arrival": "15:00",
                    "scheduled_departure": "15:05",

                    "platform": 12,

                    "arrival_delay": 5,
                    "departure_delay": 5,

                    "cancelled": 0,
                    "diverted": 0,

                    "train_type": "SPECIAL",
                },
            ],
        },
    }

    data = demo_stations.get(
        station_code
    )

    if data is None:
        return None

    return {
        **data,

        "data_source": "DEMO_FALLBACK",

        "cached": False,

        "demo": True,

        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }