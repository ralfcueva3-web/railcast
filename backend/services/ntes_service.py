from ntes import NTESClient
import re


class NTESService:

    def __init__(self):
        self.client = NTESClient(
            timeout=15,
            retries=3,
        )

    # =========================================================
    # DELAY PARSER
    # =========================================================

    def _parse_delay(self, value):
        """
        Convert NTES delay values into minutes.

        Examples:
            "RT"    -> 0
            "00:50" -> 50
            "01:20" -> 80
            10      -> 10
            None    -> 0
        """

        if value is None:
            return 0

        value = str(value).strip().upper()

        if value in ("RT", ""):
            return 0

        if ":" in value:
            try:
                hours, minutes = map(
                    int,
                    value.split(":"),
                )

                return hours * 60 + minutes

            except ValueError:
                return 0

        try:
            return float(value)

        except ValueError:
            return 0

    # =========================================================
    # NORMALIZE STATION CODE
    # =========================================================

    @staticmethod
    def _clean_code(value):
        if not value:
            return ""

        return str(value).strip().upper()

    # =========================================================
    # FIND STATION FROM CPOS
    # =========================================================

    def _get_cpos_station(
        self,
        cpos,
        route,
    ):
        """
        Extract the station from NTES CPOS.

        Example:

            "Departed from MUKURIA(MFA) at 07:35"

        becomes:

            MFA

        CPOS is useful because LSTN can sometimes remain
        stale while the train is already moving.
        """

        if not cpos:
            return None

        cpos_text = str(cpos).strip()

        # -----------------------------------------------------
        # First try the station code inside brackets.
        #
        # Example:
        # MUKURIA(MFA)
        # -----------------------------------------------------

        match = re.search(
            r"\(([A-Za-z0-9]{2,6})\)",
            cpos_text,
        )

        if match:

            code = self._clean_code(
                match.group(1)
            )

            for station in route:

                station_code = self._clean_code(
                    station.get("station_code")
                )

                if station_code == code:

                    return station

        # -----------------------------------------------------
        # If no code is present, compare station names.
        # -----------------------------------------------------

        cpos_lower = cpos_text.lower()

        for station in route:

            station_name = str(
                station.get("station_name") or ""
            ).strip()

            if not station_name:
                continue

            if station_name.lower() in cpos_lower:

                return station

        return None

    # =========================================================
    # STATION LIVE TRAINS
    # =========================================================

    def get_station_trains(
        self,
        station_code: str,
        hours: int = 4,
    ):
        """
        Get multiple live trains associated with a station.
        """

        response = self.client.station_live(
            station_code,
            hours=hours,
        )

        trains = response.get(
            "TrainsAtStation",
            [],
        )

        return {
            "station": response.get(
                "Station"
            ),

            "station_name": response.get(
                "StationName"
            ),

            "total_trains": response.get(
                "TotalTrains",
                len(trains),
            ),

            "trains": [

                {
                    "train_no": train.get(
                        "TrainNumber"
                    ),

                    "train_name": train.get(
                        "TrainName"
                    ),

                    "source": train.get(
                        "Source"
                    ),

                    "source_name": train.get(
                        "SourceName"
                    ),

                    "destination": train.get(
                        "Destination"
                    ),

                    "destination_name": train.get(
                        "DestinationName"
                    ),

                    "eta": train.get(
                        "ETA"
                    ),

                    "etd": train.get(
                        "ETD"
                    ),

                    "scheduled_arrival": train.get(
                        "STA"
                    ),

                    "scheduled_departure": train.get(
                        "STD"
                    ),

                    "platform": train.get(
                        "Platform"
                    ),

                    "arrival_delay": self._parse_delay(
                        train.get(
                            "DelayArr"
                        )
                    ),

                    "departure_delay": self._parse_delay(
                        train.get(
                            "DelayDep"
                        )
                    ),

                    "cancelled": train.get(
                        "Cancel",
                        0,
                    ),

                    "diverted": train.get(
                        "Diverted",
                        0,
                    ),

                    "train_type": train.get(
                        "TrainTypeDesc"
                    ),
                }

                for train in trains

            ],
        }

    # =========================================================
    # TRAIN STATUS
    # =========================================================

    def get_train_status(
        self,
        train_no: str,
        date: str,
    ):
        """
        Get detailed live status for a train.
        """

        return self.client.live_status(
            train_no,
            date,
        )

    # =========================================================
    # TRAIN ROUTE
    # =========================================================

    def get_train_route(
        self,
        train_no: str,
        date: str,
    ):
        """
        Get the complete dynamic NTES route.

        Current-station detection priority:

        1. Detect pre-departure state.
        2. Use CPOS when it identifies a station in route.
        3. Use NTES LSTN.
        4. Use ISA.
        5. Use latest visited station.
        6. Use source station.

        CPOS is deliberately checked before LSTN because
        NTES can sometimes leave LSTN stale.
        """

        # -----------------------------------------------------
        # GET NTES LIVE STATUS
        # -----------------------------------------------------

        response = self.client.live_status(
            train_no,
            date,
        )

        # -----------------------------------------------------
        # DEBUG NTES LIVE VALUES
        # -----------------------------------------------------

        print("\n" + "=" * 70)
        print("RAILCAST NTES ROUTE DEBUG")
        print("Train:", train_no)
        print("Date:", date)
        print("CPOS:", response.get("CPOS"))
        print("LSTN:", response.get("LSTN"))
        print("LSTNN:", response.get("LSTNN"))
        print("LDEL:", response.get("LDEL"))
        print("LASTUPD:", response.get("LASTUPD"))

        print("\nSTATION FLAGS:")

        for station in response.get(
            "STNS",
            [],
        ):
            print(
                station.get("SC"),
                "|",
                station.get("SN"),
                "| ISA:",
                station.get("ISA"),
                "| ETA:",
                station.get("ETA"),
                "| ETD:",
                station.get("ETD"),
            )

        print("=" * 70 + "\n")

        stations = response.get(
            "STNS",
            [],
        )

        route = []

        # -----------------------------------------------------
        # NORMALIZE ROUTE
        # -----------------------------------------------------

        for station in stations:

            route.append(
                {
                    "station_code": station.get(
                        "SC"
                    ),

                    "station_name": station.get(
                        "SN"
                    ),

                    "distance": station.get(
                        "DIST"
                    ),

                    "scheduled_arrival": station.get(
                        "STA"
                    ),

                    "scheduled_departure": station.get(
                        "STD"
                    ),

                    "actual_arrival": station.get(
                        "ETA"
                    ),

                    "actual_departure": station.get(
                        "ETD"
                    ),

                    "platform": station.get(
                        "PF"
                    ),

                    "arrival_delay": self._parse_delay(
                        station.get(
                            "DARR"
                        )
                    ),

                    "departure_delay": self._parse_delay(
                        station.get(
                            "DDEP"
                        )
                    ),

                    "is_current": station.get(
                        "ISA",
                        False,
                    ),
                }
            )

        # -----------------------------------------------------
        # BASIC ROUTE SAFETY
        # -----------------------------------------------------

        if not route:

            return {
                "train_no": train_no,

                "destination": response.get(
                    "DSTNN"
                ),

                "total_distance": response.get(
                    "TTLDIST"
                ),

                "current_station": "",

                "current_station_name": "",

                "last_update": response.get(
                    "LASTUPD"
                ),

                "delay": self._parse_delay(
                    response.get(
                        "LDEL"
                    )
                ),

                "yet_to_start": False,

                "route": [],
            }

        # -----------------------------------------------------
        # SOURCE / DESTINATION
        # -----------------------------------------------------

        first_station = route[0]
        last_station = route[-1]

        first_code = self._clean_code(
            first_station.get(
                "station_code"
            )
        )

        first_name = str(
            first_station.get(
                "station_name"
            ) or ""
        ).strip()

        last_code = self._clean_code(
            last_station.get(
                "station_code"
            )
        )

        # -----------------------------------------------------
        # CURRENT FLAG
        # -----------------------------------------------------

        has_current_flag = any(
            station.get(
                "is_current"
            ) is True
            for station in route
        )

        # -----------------------------------------------------
        # ACTUAL VISITED STATIONS
        # -----------------------------------------------------

        visited_entries = [

            station

            for station in route

            if (
                station.get(
                    "actual_arrival"
                )
                or
                station.get(
                    "actual_departure"
                )
            )

        ]

        has_visited_station = bool(
            visited_entries
        )

        # -----------------------------------------------------
        # NTES LSTN
        # -----------------------------------------------------

        reported_current = self._clean_code(
            response.get(
                "LSTN"
            )
        )

        reported_current_name = str(
            response.get(
                "LSTNN"
            ) or ""
        ).strip()

        # -----------------------------------------------------
        # NTES CPOS
        # -----------------------------------------------------

        cpos = response.get(
            "CPOS"
        )

        cpos_station = self._get_cpos_station(
            cpos,
            route,
        )

        # -----------------------------------------------------
        # DEBUG CURRENT-STATION DECISION
        # -----------------------------------------------------

        print(
            "RAILCAST CURRENT-STATION INPUT:"
        )

        print(
            "  CPOS:",
            cpos
        )

        print(
            "  CPOS station:",
            (
                cpos_station.get("station_code")
                if cpos_station
                else None
            )
        )

        print(
            "  LSTN:",
            reported_current
        )

        print(
            "  LSTNN:",
            reported_current_name
        )

        print(
            "  ISA current flag:",
            has_current_flag
        )

        print(
            "  Has visited station:",
            has_visited_station
        )

        # -----------------------------------------------------
        # DETECT YET-TO-START
        # -----------------------------------------------------

        """
        NTES sometimes reports the destination as LSTN
        before the train has actually departed.

        If the destination is reported while there is:

        - no current ISA flag
        - no actual movement
        - no usable CPOS station

        then treat the train as pre-departure.
        """

        not_started = (
            reported_current == last_code
            and not has_current_flag
            and not has_visited_station
            and not cpos_station
            and first_code != last_code
        )

        # -----------------------------------------------------
        # DETERMINE CURRENT STATION
        # -----------------------------------------------------

        current_station = first_code
        current_station_name = first_name

        # -----------------------------------------------------
        # CASE 1:
        # TRAIN HAS NOT STARTED
        # -----------------------------------------------------

        if not_started:

            current_station = first_code

            current_station_name = first_name

            decision = "SOURCE - TRAIN NOT STARTED"

        # -----------------------------------------------------
        # CASE 2:
        # CPOS HAS A VALID ROUTE STATION
        # -----------------------------------------------------

        elif cpos_station:

            current_station = self._clean_code(
                cpos_station.get(
                    "station_code"
                )
            )

            current_station_name = str(
                cpos_station.get(
                    "station_name"
                ) or ""
            ).strip()

            decision = "CPOS"

        # -----------------------------------------------------
        # CASE 3:
        # LSTN IS VALID
        # -----------------------------------------------------

        elif (
            reported_current
            and any(

                self._clean_code(
                    station.get(
                        "station_code"
                    )
                )
                == reported_current

                for station in route

            )
        ):

            current_station = reported_current

            current_station_name = (
                reported_current_name
            )

            decision = "LSTN"

        # -----------------------------------------------------
        # CASE 4:
        # ISA CURRENT FLAG
        # -----------------------------------------------------

        elif has_current_flag:

            current_entries = [

                station

                for station in route

                if station.get(
                    "is_current"
                ) is True

            ]

            if current_entries:

                current_station = self._clean_code(
                    current_entries[0].get(
                        "station_code"
                    )
                )

                current_station_name = str(
                    current_entries[0].get(
                        "station_name"
                    ) or ""
                ).strip()

                decision = "ISA"

            else:

                decision = "SOURCE FALLBACK"

        # -----------------------------------------------------
        # CASE 5:
        # LATEST VISITED STATION
        # -----------------------------------------------------

        elif has_visited_station:

            latest = visited_entries[-1]

            current_station = self._clean_code(
                latest.get(
                    "station_code"
                )
            )

            current_station_name = str(
                latest.get(
                    "station_name"
                ) or ""
            ).strip()

            decision = "LATEST VISITED"

        # -----------------------------------------------------
        # CASE 6:
        # SOURCE FALLBACK
        # -----------------------------------------------------

        else:

            current_station = first_code

            current_station_name = first_name

            decision = "SOURCE FALLBACK"

        # -----------------------------------------------------
        # FINAL DEBUG RESULT
        # -----------------------------------------------------

        print(
            "  CURRENT-STATION DECISION:",
            decision
        )

        print(
            "  FINAL CURRENT STATION:",
            current_station
        )

        print(
            "  FINAL CURRENT NAME:",
            current_station_name
        )

        # -----------------------------------------------------
        # NTES DELAY
        # -----------------------------------------------------

        ntes_delay = self._parse_delay(
            response.get(
                "LDEL"
            )
        )

        # -----------------------------------------------------
        # PRE-DEPARTURE DELAY FIX
        # -----------------------------------------------------

        if not_started:

            effective_delay = 0

        else:

            effective_delay = ntes_delay

        # -----------------------------------------------------
        # FINAL DEBUG SUMMARY
        # -----------------------------------------------------

        print(
            "  NTES DELAY:",
            ntes_delay
        )

        print(
            "  EFFECTIVE DELAY:",
            effective_delay
        )

        print(
            "=" * 70 + "\n"
        )

        # -----------------------------------------------------
        # RETURN NORMALIZED DATA
        # -----------------------------------------------------

        return {

            "train_no": train_no,

            "destination": response.get(
                "DSTNN"
            ),

            "total_distance": response.get(
                "TTLDIST"
            ),

            "current_station": current_station,

            "current_station_name":
                current_station_name,

            "last_update": response.get(
                "LASTUPD"
            ),

            "delay": effective_delay,

            "ntes_reported_delay":
                ntes_delay,

            "yet_to_start":
                not_started,

            "route": route,

        }