import {
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
    type KeyboardEvent,
} from "react";

import {
    getETA,
    getStationTrains,
    getTrainStatus,
    getTrainRoute,
} from "../api/trainApi";

import type { ETAResponse } from "../types";

// =============================================================
// TYPES
// =============================================================

type StationOption = {
    code: string;
    name: string;
};

type MobileTab = "board" | "details";

// =============================================================
// STATIONS
// =============================================================

const STATION_OPTIONS: StationOption[] = [
    { code: "HWH", name: "Howrah Jn" },
    { code: "NJP", name: "New Jalpaiguri" },
    { code: "RPH", name: "Rampur Hat" },
    { code: "SNT", name: "Sainthia Jn" },
    { code: "BHP", name: "Bolpur Shantiniketan" },
    { code: "SDAH", name: "Sealdah" },
    { code: "BWN", name: "Barddhaman" },
    { code: "BDC", name: "Bandel Jn" },
    { code: "NDLS", name: "New Delhi" },
];

// =============================================================
// HELPERS
// =============================================================

function normalizeTrainNumber(value: unknown): string {
    return String(value ?? "")
        .trim()
        .padStart(5, "0");
}

function safeString(value: unknown): string {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}

function getTodayNTESDate(): string {
    const now = new Date();

    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];

    return `${String(now.getDate()).padStart(2, "0")}-${months[now.getMonth()]}-${now.getFullYear()}`;
}

function formatClock(
    value?: string | null,
): string {
    if (!value) {
        return "—";
    }

    const raw = String(value);

    if (
        /^\d{1,2}:\d{2}$/.test(
            raw,
        )
    ) {
        return raw;
    }

    try {
        const date = new Date(raw);

        if (
            !Number.isNaN(
                date.getTime(),
            )
        ) {
            return date.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit",
                },
            );
        }
    } catch {
        // Ignore.
    }

    return raw;
}

function formatDelay(
    value: unknown,
): string {
    const delay = Number(
        value ?? 0,
    );

    if (!Number.isFinite(delay)) {
        return "On time";
    }

    if (delay > 0) {
        return `+${Math.round(delay)}m`;
    }

    if (delay < 0) {
        return `${Math.round(delay)}m`;
    }

    return "On time";
}

function delayClass(
    value: unknown,
): string {
    const delay = Number(
        value ?? 0,
    );

    if (delay > 15) {
        return "text-rose-500";
    }

    if (delay > 5) {
        return "text-amber-500";
    }

    if (delay < -2) {
        return "text-cyan-600";
    }

    return "text-emerald-600";
}

function delayBadgeClass(
    value: unknown,
): string {
    const delay = Number(
        value ?? 0,
    );

    if (delay > 15) {
        return "border-rose-200 bg-rose-50 text-rose-600";
    }

    if (delay > 5) {
        return "border-amber-200 bg-amber-50 text-amber-600";
    }

    if (delay < -2) {
        return "border-cyan-200 bg-cyan-50 text-cyan-600";
    }

    return "border-emerald-200 bg-emerald-50 text-emerald-600";
}

function delayLabel(
    value: unknown,
): string {
    const delay = Number(
        value ?? 0,
    );

    if (delay > 15) {
        return "Major delay";
    }

    if (delay > 5) {
        return "Running late";
    }

    if (delay < -2) {
        return "Running early";
    }

    return "On schedule";
}

function getStationName(
    code: string,
    stationData?: any,
): string {
    if (
        stationData?.station_name
    ) {
        return stationData.station_name;
    }

    const station =
        STATION_OPTIONS.find(
            (item) =>
                item.code.toUpperCase() ===
                code.toUpperCase(),
        );

    return (
        station?.name ??
        code
    );
}

// =============================================================
// COMPONENT
// =============================================================

export default function PassengerView() {
    // =========================================================
    // STATION
    // =========================================================

    const [selectedStation, setSelectedStation] =
        useState("");

    const [stationInput, setStationInput] =
        useState("");

    const [stationData, setStationData] =
        useState<any>(null);

    const [loadingStation, setLoadingStation] =
        useState(false);

    const [stationError, setStationError] =
        useState<string | null>(null);

    const [lastUpdated, setLastUpdated] =
        useState<string | null>(null);

    // =========================================================
    // TRAIN
    // =========================================================

    const [selectedTrain, setSelectedTrain] =
        useState<string | null>(null);

    const [selectedTrainStatus, setSelectedTrainStatus] =
        useState<any>(null);

    const [selectedTrainRoute, setSelectedTrainRoute] =
        useState<any>(null);

    const [selectedTrainError, setSelectedTrainError] =
        useState<string | null>(null);

    const [loadingTrain, setLoadingTrain] =
        useState(false);

    const [trainSearch, setTrainSearch] =
        useState("");

    // =========================================================
    // ETA
    // =========================================================

    const [payload, setPayload] =
        useState<ETAResponse | null>(null);

    // =========================================================
    // MOBILE
    // =========================================================

    const [mobileTab, setMobileTab] =
        useState<MobileTab>("board");

    // =========================================================
    // STATION SUGGESTIONS
    // =========================================================

    const stationSuggestions =
        useMemo(() => {
            const query =
                stationInput
                    .trim()
                    .toLowerCase();

            if (!query) {
                return STATION_OPTIONS;
            }

            return STATION_OPTIONS.filter(
                (station) =>
                    station.code
                        .toLowerCase()
                        .includes(query) ||
                    station.name
                        .toLowerCase()
                        .includes(query),
            );
        }, [
            stationInput,
        ]);

    // =========================================================
    // LOAD STATION
    // =========================================================

    const loadStationBoard =
        async (
            stationCode: string,
        ) => {
            const code =
                stationCode
                    .trim()
                    .toUpperCase();

            if (!code) {
                return;
            }

            setLoadingStation(true);
            setStationError(null);

            setSelectedTrain(null);
            setSelectedTrainStatus(null);
            setSelectedTrainRoute(null);
            setSelectedTrainError(null);
            setPayload(null);

            try {
                const data =
                    await getStationTrains(
                        code,
                    );

                setStationData(
                    data,
                );

                const returnedCode =
                    safeString(
                        data?.station ||
                            code,
                    ).toUpperCase();

                setSelectedStation(
                    returnedCode,
                );

                const returnedName =
                    getStationName(
                        returnedCode,
                        data,
                    );

                setStationInput(
                    `${returnedName} (${returnedCode})`,
                );

                setLastUpdated(
                    new Date().toLocaleTimeString(
                        [],
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        },
                    ),
                );
            } catch (error) {
                console.error(
                    "Station board request failed:",
                    error,
                );

                setStationData(
                    null,
                );

                setStationError(
                    error instanceof Error
                        ? error.message
                        : "Unable to load station board.",
                );
            } finally {
                setLoadingStation(
                    false,
                );
            }
        };

    // =========================================================
    // SELECT STATION
    // =========================================================

    const selectStation =
        (
            station: StationOption,
        ) => {
            const code =
                station.code.toUpperCase();

            setSelectedStation(
                code,
            );

            setStationInput(
                `${station.name} (${station.code})`,
            );

            setSelectedTrain(
                null,
            );

            setSelectedTrainStatus(
                null,
            );

            setSelectedTrainRoute(
                null,
            );

            setSelectedTrainError(
                null,
            );

            setPayload(
                null,
            );

            void loadStationBoard(
                code,
            );
        };

    // =========================================================
    // SELECT CHANGE
    // =========================================================

    const handleStationChange =
        (
            event: ChangeEvent<HTMLSelectElement>,
        ) => {
            const code =
                event.target.value
                    .trim()
                    .toUpperCase();

            if (!code) {
                return;
            }

            const station =
                STATION_OPTIONS.find(
                    (item) =>
                        item.code ===
                        code,
                );

            if (station) {
                selectStation(
                    station,
                );
            }
        };

    // =========================================================
    // STATION SEARCH
    // =========================================================

    const handleStationSearch =
        () => {
            const input =
                stationInput
                    .trim()
                    .toUpperCase();

            if (!input) {
                return;
            }

            const codeMatch =
                input.match(
                    /\(([A-Z0-9]{2,6})\)/,
                );

            const code =
                codeMatch?.[1] ?? "";

            const station =
                STATION_OPTIONS.find(
                    (item) =>
                        item.code ===
                            input ||
                        item.code ===
                            code ||
                        item.name
                            .toUpperCase()
                            .includes(
                                input,
                            ),
                );

            if (station) {
                selectStation(
                    station,
                );

                return;
            }

            const cleanCode =
                input
                    .replace(
                        /[^A-Z0-9]/g,
                        "",
                    )
                    .slice(
                        0,
                        6,
                    );

            if (cleanCode) {
                setSelectedStation(
                    cleanCode,
                );

                void loadStationBoard(
                    cleanCode,
                );
            }
        };

    const handleStationKeyDown =
        (
            event: KeyboardEvent<HTMLInputElement>,
        ) => {
            if (
                event.key ===
                "Enter"
            ) {
                event.preventDefault();

                handleStationSearch();
            }
        };

    // =========================================================
    // STATION REFRESH
    // =========================================================

    useEffect(() => {
        if (!selectedStation) {
            return;
        }

        let cancelled =
            false;

        const refresh =
            async () => {
                try {
                    const data =
                        await getStationTrains(
                            selectedStation,
                        );

                    if (
                        cancelled
                    ) {
                        return;
                    }

                    setStationData(
                        data,
                    );

                    const code =
                        safeString(
                            data?.station ||
                                selectedStation,
                        ).toUpperCase();

                    setSelectedStation(
                        code,
                    );

                    setStationInput(
                        `${getStationName(
                            code,
                            data,
                        )} (${code})`,
                    );

                    setLastUpdated(
                        new Date().toLocaleTimeString(
                            [],
                            {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                            },
                        ),
                    );
                } catch {
                    // Keep existing data.
                }
            };

        const interval =
            window.setInterval(
                refresh,
                60_000,
            );

        return () => {
            cancelled = true;

            window.clearInterval(
                interval,
            );
        };
    }, [
        selectedStation,
    ]);

    // =========================================================
    // CURRENT STATION
    // =========================================================

    const getCurrentStation =
        (
            routeData: any,
            statusData: any,
        ): string => {
            const route =
                Array.isArray(
                    routeData?.route,
                )
                    ? routeData.route
                    : [];

            const normalized =
                route.map(
                    (
                        station: any,
                    ) => ({
                        code: safeString(
                            station?.station_code,
                        ).toUpperCase(),

                        name: safeString(
                            station?.station_name,
                        ),
                    }),
                );

            const first =
                normalized[0];

            const statusText = [
                statusData?.CPOS,
                statusData?.STATUS,
                statusData?.STTS,
                statusData?.LSTN,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const notStarted =
                statusText.includes(
                    "yet to start",
                ) ||
                statusText.includes(
                    "not started",
                );

            if (
                notStarted &&
                first?.code
            ) {
                return first.code;
            }

            const cpos =
                safeString(
                    statusData?.CPOS,
                );

            const match =
                cpos.match(
                    /\(([A-Za-z0-9]{2,6})\)/,
                );

            if (
                match?.[1]
            ) {
                return match[1]
                    .trim()
                    .toUpperCase();
            }

            const lstn =
                safeString(
                    statusData?.LSTN,
                ).toUpperCase();

            if (
                lstn &&
                normalized.some(
                    (
                        station: any,
                    ) =>
                        station.code ===
                        lstn,
                )
            ) {
                return lstn;
            }

            return (
                first?.code ||
                selectedStation
            );
        };

    // =========================================================
    // TRAIN CLICK
    // =========================================================

    const handleTrainClick =
        async (
            train: any,
        ) => {
            const trainNumber =
                normalizeTrainNumber(
                    train?.train_no,
                );

            if (!trainNumber) {
                return;
            }

            setSelectedTrain(
                trainNumber,
            );

            setSelectedTrainStatus(
                null,
            );

            setSelectedTrainRoute(
                null,
            );

            setSelectedTrainError(
                null,
            );

            setPayload(
                null,
            );

            setLoadingTrain(
                true,
            );

            setMobileTab(
                "details",
            );

            const date =
                getTodayNTESDate();

            let statusData:
                any = null;

            let routeData:
                any = null;

            let etaData:
                ETAResponse | null =
                null;

            // STATUS
            try {
                statusData =
                    await getTrainStatus(
                        trainNumber,
                        date,
                    );

                setSelectedTrainStatus(
                    statusData,
                );
            } catch (error) {
                console.warn(
                    "Train status unavailable:",
                    error,
                );
            }

            // ROUTE
            try {
                routeData =
                    await getTrainRoute(
                        trainNumber,
                        date,
                    );

                setSelectedTrainRoute(
                    routeData,
                );
            } catch (error) {
                console.warn(
                    "Train route unavailable:",
                    error,
                );
            }

            // CURRENT LOCATION
            const currentStation =
                getCurrentStation(
                    routeData,
                    statusData,
                );

            // ETA
            try {
                etaData =
                    await getETA(
                        trainNumber,
                        currentStation,
                    );

                setPayload(
                    etaData,
                );
            } catch (error) {
                console.warn(
                    "ETA unavailable:",
                    error,
                );
            }

            if (
                !statusData &&
                !routeData &&
                !etaData
            ) {
                setSelectedTrainError(
                    "Detailed railway information is temporarily unavailable for this train.",
                );
            } else if (
                !etaData
            ) {
                setSelectedTrainError(
                    "Railway status is available, but RailSaathi prediction is temporarily unavailable.",
                );
            }

            setLastUpdated(
                new Date().toLocaleTimeString(
                    [],
                    {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                    },
                ),
            );

            setLoadingTrain(
                false,
            );
        };

    // =========================================================
    // TRAIN REFRESH
    // =========================================================

    useEffect(() => {
        if (!selectedTrain) {
            return;
        }

        let cancelled =
            false;

        const refresh =
            async () => {
                const date =
                    getTodayNTESDate();

                let statusData:
                    any = null;

                let routeData:
                    any = null;

                try {
                    statusData =
                        await getTrainStatus(
                            selectedTrain,
                            date,
                        );

                    if (
                        !cancelled
                    ) {
                        setSelectedTrainStatus(
                            statusData,
                        );
                    }
                } catch {
                    // Keep current.
                }

                try {
                    routeData =
                        await getTrainRoute(
                            selectedTrain,
                            date,
                        );

                    if (
                        !cancelled
                    ) {
                        setSelectedTrainRoute(
                            routeData,
                        );
                    }
                } catch {
                    // Keep current.
                }

                const currentStation =
                    getCurrentStation(
                        routeData,
                        statusData,
                    );

                try {
                    const eta =
                        await getETA(
                            selectedTrain,
                            currentStation,
                        );

                    if (
                        !cancelled
                    ) {
                        setPayload(
                            eta,
                        );

                        setSelectedTrainError(
                            null,
                        );

                        setLastUpdated(
                            new Date().toLocaleTimeString(
                                [],
                                {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                },
                            ),
                        );
                    }
                } catch {
                    // Keep current ETA.
                }
            };

        const interval =
            window.setInterval(
                refresh,
                60_000,
            );

        return () => {
            cancelled = true;

            window.clearInterval(
                interval,
            );
        };
    }, [
        selectedTrain,
    ]);

    // =========================================================
    // FILTERED TRAINS
    // =========================================================

    const filteredTrains =
        useMemo(() => {
            const trains =
                stationData?.trains ??
                [];

            const query =
                trainSearch
                    .trim()
                    .toLowerCase();

            if (!query) {
                return trains;
            }

            return trains.filter(
                (train: any) => {
                    const number =
                        normalizeTrainNumber(
                            train?.train_no,
                        ).toLowerCase();

                    const name =
                        safeString(
                            train?.train_name,
                        ).toLowerCase();

                    const source =
                        safeString(
                            train?.source_name ||
                                train?.source,
                        ).toLowerCase();

                    const destination =
                        safeString(
                            train?.destination_name ||
                                train?.destination,
                        ).toLowerCase();

                    return (
                        number.includes(
                            query,
                        ) ||
                        name.includes(
                            query,
                        ) ||
                        source.includes(
                            query,
                        ) ||
                        destination.includes(
                            query,
                        )
                    );
                },
            );
        }, [
            stationData,
            trainSearch,
        ]);

    // =========================================================
    // SELECTED BOARD TRAIN
    // =========================================================

    const selectedBoardTrain =
        stationData?.trains?.find(
            (train: any) =>
                normalizeTrainNumber(
                    train?.train_no,
                ) ===
                selectedTrain,
        ) ?? null;

    // =========================================================
    // CURRENT
    // =========================================================

    const current =
        selectedTrainRoute ||
        selectedTrainStatus
            ? getCurrentStation(
                  selectedTrainRoute,
                  selectedTrainStatus,
              )
            : selectedStation;

    // =========================================================
    // ROUTE
    // =========================================================

    const routeStations =
        Array.isArray(
            selectedTrainRoute?.route,
        )
            ? selectedTrainRoute.route
            : [];

    // =========================================================
    // CURRENT INDEX
    // =========================================================

    const currentRouteIndex =
        routeStations.findIndex(
            (station: any) =>
                safeString(
                    station?.station_code,
                ).toUpperCase() ===
                current.toUpperCase(),
        );

    // =========================================================
    // CURRENT STATION NAME
    // =========================================================

    const currentStationName =
        routeStations.find(
            (station: any) =>
                safeString(
                    station?.station_code,
                ).toUpperCase() ===
                current.toUpperCase(),
        )?.station_name ||
        selectedTrainStatus?.LSTNN ||
        getStationName(
            current,
            stationData,
        ) ||
        current ||
        "Unknown";

    // =========================================================
    // NEXT STATION
    // =========================================================

    const nextStation =
        currentRouteIndex >= 0 &&
        currentRouteIndex + 1 <
            routeStations.length
            ? routeStations[
                  currentRouteIndex + 1
              ]
            : null;

    // =========================================================
    // DESTINATION
    // =========================================================

    const destinationStation =
        routeStations.length > 0
            ? routeStations[
                  routeStations.length -
                      1
              ]
            : null;

    // =========================================================
    // DISTANCE
    // =========================================================

    const currentDistance =
        currentRouteIndex >= 0
            ? Number(
                  routeStations[
                      currentRouteIndex
                  ]?.distance ??
                      0,
              )
            : 0;

    const totalDistance =
        routeStations.length > 0
            ? Number(
                  routeStations[
                      routeStations.length -
                          1
                  ]?.distance ??
                      0,
              )
            : 0;

    const progress =
        totalDistance > 0
            ? Math.min(
                  100,
                  Math.max(
                      0,
                      (currentDistance /
                          totalDistance) *
                          100,
                  ),
              )
            : 0;

    // =========================================================
    // PREDICTIONS
    // =========================================================

    const predictions =
        payload?.predictions ??
        [];

    // =========================================================
    // PREDICTION MAP
    //
    // This is important.
    //
    // The old timeline could leave a huge blank area when
    // route stations and predictions were not aligned.
    //
    // We explicitly match predictions to route station codes.
    // =========================================================

    const predictionByCode =
        useMemo(() => {
            const map =
                new Map<
                    string,
                    any
                >();

            predictions.forEach(
                (prediction: any) => {
                    const code =
                        safeString(
                            prediction
                                ?.station
                                ?.code,
                        ).toUpperCase();

                    if (code) {
                        map.set(
                            code,
                            prediction,
                        );
                    }
                },
            );

            return map;
        }, [
            predictions,
        ]);

    // =========================================================
    // UPCOMING ROUTE
    //
    // Compact list only.
    // No giant empty timeline.
    // =========================================================

    const upcomingStations =
        useMemo(() => {
            if (
                routeStations.length ===
                0
            ) {
                return [];
            }

            let startIndex =
                currentRouteIndex >=
                0
                    ? currentRouteIndex
                    : 0;

            const stations =
                routeStations
                    .slice(
                        startIndex,
                        startIndex +
                            7,
                    )
                    .map(
                        (
                            station: any,
                            index: number,
                        ) => {
                            const code =
                                safeString(
                                    station?.station_code,
                                ).toUpperCase();

                            const prediction =
                                predictionByCode.get(
                                    code,
                                );

                            return {
                                station,
                                prediction,
                                isCurrent:
                                    index ===
                                    0,
                            };
                        },
                    );

            return stations;
        }, [
            routeStations,
            currentRouteIndex,
            predictionByCode,
        ]);

    // =========================================================
    // TRAIN NAME
    // =========================================================

    const trainName =
        selectedTrainStatus?.TNM ||
        selectedTrainStatus?.TRAIN_NAME ||
        selectedBoardTrain?.train_name ||
        "Selected Train";

    // =========================================================
    // CURRENT DELAY
    // =========================================================

    const currentDelay =
        Number(
            payload?.current_delay_minutes ??
                selectedTrainStatus?.LDEL ??
                selectedBoardTrain?.arrival_delay ??
                0,
        );

    // =========================================================
    // FINAL PREDICTED DELAY
    // =========================================================

    const lastPrediction =
        predictions[
            predictions.length -
                1
        ] ?? null;

    const finalDelay =
        lastPrediction
            ? Number(
                  lastPrediction.delay_minutes ??
                      0,
              )
            : currentDelay;

    const delayChange =
        finalDelay -
        currentDelay;

    // =========================================================
    // DATA SOURCE
    // =========================================================

    const dataSource =
        stationData?.data_source ||
        "UNAVAILABLE";

    const sourceLabel =
        dataSource ===
        "NTES_LIVE"
            ? "NTES LIVE"
            : dataSource ===
                "REDIS_CACHE"
              ? "REDIS CACHE"
              : dataSource ===
                  "DEMO_FALLBACK"
                ? "DEMO FALLBACK"
                : "NO DATA";

    const sourceClass =
        dataSource ===
        "NTES_LIVE"
            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
            : dataSource ===
                "REDIS_CACHE"
              ? "border-blue-200 bg-blue-50 text-blue-600"
              : dataSource ===
                  "DEMO_FALLBACK"
                ? "border-amber-200 bg-amber-50 text-amber-600"
                : "border-slate-200 bg-slate-50 text-slate-500";

    // =============================================================
    // RENDER
    // =============================================================

    return (
        <main className="min-h-screen overflow-hidden bg-[#F5F8FC] text-slate-900">
            {/* =====================================================
                ANIMATIONS
            ===================================================== */}

            <style>
                {`
                    @keyframes railFloat {
                        0%, 100% {
                            transform: translateY(0);
                        }

                        50% {
                            transform: translateY(-8px);
                        }
                    }

                    @keyframes pulseSoft {
                        0%, 100% {
                            opacity: .45;
                            transform: scale(1);
                        }

                        50% {
                            opacity: 1;
                            transform: scale(1.15);
                        }
                    }

                    @keyframes trainMove {
                        0%, 100% {
                            transform: translateX(-7px);
                        }

                        50% {
                            transform: translateX(7px);
                        }
                    }

                    @keyframes slideUp {
                        from {
                            opacity: 0;
                            transform: translateY(12px);
                        }

                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    @keyframes shimmer {
                        0% {
                            background-position: -600px 0;
                        }

                        100% {
                            background-position: 600px 0;
                        }
                    }

                    .rail-float {
                        animation:
                            railFloat 5s ease-in-out infinite;
                    }

                    .soft-pulse {
                        animation:
                            pulseSoft 2.3s ease-in-out infinite;
                    }

                    .train-motion {
                        animation:
                            trainMove 2.5s ease-in-out infinite;
                    }

                    .slide-up {
                        animation:
                            slideUp .45s ease-out both;
                    }

                    .skeleton {
                        background:
                            linear-gradient(
                                90deg,
                                #eef2f7,
                                #f8fafc,
                                #eef2f7
                            );

                        background-size: 600px 100%;

                        animation:
                            shimmer 1.5s linear infinite;
                    }

                    .scrollbar-thin::-webkit-scrollbar {
                        width: 5px;
                        height: 5px;
                    }

                    .scrollbar-thin::-webkit-scrollbar-track {
                        background: transparent;
                    }

                    .scrollbar-thin::-webkit-scrollbar-thumb {
                        background: #d9e2ef;
                        border-radius: 999px;
                    }
                `}
            </style>

            {/* =====================================================
                BACKGROUND
            ===================================================== */}

            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-blue-200/30 blur-[100px]" />

                <div className="absolute right-[-100px] top-[20%] h-[420px] w-[420px] rounded-full bg-cyan-100/50 blur-[110px]" />

                <div className="absolute bottom-[-150px] left-[30%] h-[420px] w-[420px] rounded-full bg-indigo-100/40 blur-[120px]" />
            </div>

            <div className="relative mx-auto max-w-[1550px] px-4 py-4 sm:px-6 lg:px-8">
                {/* =================================================
                    HEADER
                ================================================= */}

                <header className="slide-up mb-5 rounded-[30px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_15px_50px_rgba(15,23,42,.07)] backdrop-blur-xl">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="rail-float relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-2xl text-white shadow-lg shadow-blue-500/20">
                                🚆

                                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
                            </div>

                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-extrabold tracking-[.3em] text-blue-600">
                                        RAILSAATHI
                                    </span>

                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-bold text-blue-600">
                                        AI
                                    </span>
                                </div>

                                <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                    Railway Intelligence Platform
                                </h1>

                                <p className="mt-1 text-xs text-slate-400">
                                    Live movement • Predictive ETA • Intelligent railway insights
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-600">
                                <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                SYSTEM ONLINE
                            </span>
                        </div>
                    </div>
                </header>

                {/* =================================================
                    SEARCH AREA
                ================================================= */}

                <section className="slide-up mb-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,.05)]">
                    <div className="grid gap-4 lg:grid-cols-[1fr_1.7fr_auto]">
                        {/* MONITORING STATION */}
                        <div className="relative">
                            <label className="mb-2 block px-1 text-[9px] font-extrabold uppercase tracking-[.2em] text-slate-400">
                                Monitoring station
                            </label>

                            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
                                <span className="pl-4 text-lg">
                                    📍
                                </span>

                                <input
                                    value={
                                        stationInput
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setStationInput(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    onKeyDown={
                                        handleStationKeyDown
                                    }
                                    placeholder="Search station..."
                                    className="h-[54px] min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-300"
                                />

                                <button
                                    type="button"
                                    onClick={
                                        handleStationSearch
                                    }
                                    disabled={
                                        !stationInput.trim() ||
                                        loadingStation
                                    }
                                    className="mr-2 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    →
                                </button>
                            </div>

                            {stationInput.trim() &&
                                !selectedStation && (
                                    <div className="absolute left-0 right-0 top-[78px] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_60px_rgba(15,23,42,.15)]">
                                        {stationSuggestions
                                            .slice(
                                                0,
                                                6,
                                            )
                                            .map(
                                                (
                                                    station,
                                                ) => (
                                                    <button
                                                        key={
                                                            station.code
                                                        }
                                                        type="button"
                                                        onClick={() =>
                                                            selectStation(
                                                                station,
                                                            )
                                                        }
                                                        className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-blue-50"
                                                    >
                                                        <div>
                                                            <p className="text-xs font-extrabold text-slate-700">
                                                                {
                                                                    station.name
                                                                }
                                                            </p>

                                                            <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                                                                {
                                                                    station.code
                                                                }
                                                            </p>
                                                        </div>

                                                        <span className="text-blue-500">
                                                            →
                                                        </span>
                                                    </button>
                                                ),
                                            )}
                                    </div>
                                )}
                        </div>

                        {/* TRAIN SEARCH */}
                        <div>
                            <label className="mb-2 block px-1 text-[9px] font-extrabold uppercase tracking-[.2em] text-slate-400">
                                Search train
                            </label>

                            <div className="flex h-[54px] items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
                                <span className="mr-3 text-lg text-slate-400">
                                    ⌕
                                </span>

                                <input
                                    value={
                                        trainSearch
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setTrainSearch(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Train number, train name or destination..."
                                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        {/* REFRESH */}
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={() =>
                                    selectedStation &&
                                    void loadStationBoard(
                                        selectedStation,
                                    )
                                }
                                disabled={
                                    !selectedStation ||
                                    loadingStation
                                }
                                className="h-[54px] w-full rounded-2xl border border-slate-200 bg-white px-6 text-xs font-bold text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
                            >
                                {loadingStation
                                    ? "Updating..."
                                    : "↻ Refresh"}
                            </button>
                        </div>
                    </div>

                    {/* QUICK STATIONS */}
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                        {STATION_OPTIONS.slice(
                            0,
                            7,
                        ).map(
                            (station) => {
                                const active =
                                    selectedStation ===
                                    station.code;

                                return (
                                    <button
                                        key={
                                            station.code
                                        }
                                        type="button"
                                        onClick={() =>
                                            selectStation(
                                                station,
                                            )
                                        }
                                        className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition-all ${
                                            active
                                                ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                                : "border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
                                        }`}
                                    >
                                        <div className="text-xs font-black">
                                            {
                                                station.code
                                            }
                                        </div>

                                        <div
                                            className={`mt-0.5 text-[9px] ${
                                                active
                                                    ? "text-blue-100"
                                                    : "text-slate-400"
                                            }`}
                                        >
                                            {
                                                station.name
                                            }
                                        </div>
                                    </button>
                                );
                            },
                        )}
                    </div>

                    {stationError && (
                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-600">
                            {stationError}
                        </div>
                    )}
                </section>

                {/* =================================================
                    NO STATION
                ================================================= */}

                {!selectedStation && (
                    <>
                        <section className="slide-up relative overflow-hidden rounded-[34px] border border-blue-100 bg-white shadow-[0_25px_80px_rgba(30,64,175,.08)]">
                            <div className="absolute right-[-80px] top-[-100px] h-[360px] w-[360px] rounded-full bg-blue-100/60 blur-[80px]" />

                            <div className="absolute bottom-[-100px] left-[25%] h-[280px] w-[280px] rounded-full bg-cyan-100/60 blur-[90px]" />

                            <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center lg:p-12">
                                <div>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5">
                                        <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-blue-500" />

                                        <span className="text-[9px] font-extrabold uppercase tracking-[.2em] text-blue-600">
                                            Live railway intelligence
                                        </span>
                                    </div>

                                    <h2 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-[-.04em] text-slate-900 sm:text-5xl lg:text-6xl">
                                        Your train.

                                        <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                                            Smarter than ever.
                                        </span>
                                    </h2>

                                    <p className="mt-5 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                                        Search for a railway station to see live train movement, delay status and RailSaathi's AI-powered arrival predictions.
                                    </p>

                                    <div className="mt-8 flex items-center justify-between">
                                        <div className="h-4 w-4 rounded-full border-4 border-white bg-blue-500 shadow-md" />

                                        <div className="train-motion rounded-full bg-blue-600 px-5 py-2.5 text-white shadow-lg shadow-blue-500/20">
                                            🚆
                                        </div>

                                        <div className="h-4 w-4 rounded-full border-4 border-white bg-cyan-500 shadow-md" />
                                    </div>
                                </div>

                                {/* SELECT STATION */}
                                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,.08)] sm:p-7">
                                    <p className="text-[9px] font-extrabold uppercase tracking-[.22em] text-blue-600">
                                        Start monitoring
                                    </p>

                                    <h3 className="mt-2 text-2xl font-bold text-slate-900">
                                        Choose a station
                                    </h3>

                                    <p className="mt-2 text-xs leading-5 text-slate-400">
                                        Select or search a station. The selected station becomes the monitoring station.
                                    </p>

                                    <div className="mt-6">
                                        <select
                                            value={
                                                selectedStation
                                            }
                                            onChange={
                                                handleStationChange
                                            }
                                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                                        >
                                            <option
                                                value=""
                                            >
                                                Select station
                                            </option>

                                            {STATION_OPTIONS.map(
                                                (
                                                    station,
                                                ) => (
                                                    <option
                                                        key={
                                                            station.code
                                                        }
                                                        value={
                                                            station.code
                                                        }
                                                    >
                                                        {
                                                            station.name
                                                        }{" "}
                                                        (
                                                        {
                                                            station.code
                                                        }
                                                        )
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </div>

                                    <div className="my-5 flex items-center gap-3">
                                        <div className="h-px flex-1 bg-slate-100" />

                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                                            or search
                                        </span>

                                        <div className="h-px flex-1 bg-slate-100" />
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            value={
                                                stationInput
                                            }
                                            onChange={(
                                                event,
                                            ) =>
                                                setStationInput(
                                                    event
                                                        .target
                                                        .value,
                                                )
                                            }
                                            onKeyDown={
                                                handleStationKeyDown
                                            }
                                            placeholder="NJP, HWH, RPH..."
                                            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold uppercase text-slate-700 outline-none placeholder:text-slate-300 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                                        />

                                        <button
                                            type="button"
                                            onClick={
                                                handleStationSearch
                                            }
                                            disabled={
                                                !stationInput.trim()
                                            }
                                            className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-40"
                                        >
                                            →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* WEATHER WHEN NO STATION */}
                        <section className="mt-5 rounded-[28px] border border-sky-100 bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-2xl">
                                    ☁️
                                </div>

                                <div>
                                    <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-sky-600">
                                        Weather intelligence
                                    </p>

                                    <h3 className="mt-1 text-sm font-black text-slate-800">
                                        Weather details unavailable
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-400">
                                        Weather data is not connected to the current demo environment.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {/* =================================================
                    STATION DASHBOARD
                ================================================= */}

                {selectedStation && (
                    <>
                        {/* MOBILE TABS */}
                        <div className="mb-4 flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm lg:hidden">
                            <button
                                type="button"
                                onClick={() =>
                                    setMobileTab(
                                        "board",
                                    )
                                }
                                className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold ${
                                    mobileTab ===
                                    "board"
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400"
                                }`}
                            >
                                Station Board
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setMobileTab(
                                        "details",
                                    )
                                }
                                className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold ${
                                    mobileTab ===
                                    "details"
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400"
                                }`}
                            >
                                Train Intelligence
                            </button>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
                            {/* =================================================
                                STATION BOARD
                            ================================================= */}

                            <section
                                className={`${
                                    mobileTab ===
                                    "details"
                                        ? "hidden lg:block"
                                        : ""
                                } overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_15px_50px_rgba(15,23,42,.06)]`}
                            >
                                <div className="border-b border-slate-100 px-5 py-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="soft-pulse h-2 w-2 rounded-full bg-emerald-500" />

                                                <p className="text-[9px] font-extrabold uppercase tracking-[.22em] text-emerald-600">
                                                    Live station board
                                                </p>
                                            </div>

                                            <h2 className="mt-2 text-xl font-extrabold text-slate-900">
                                                {getStationName(
                                                    selectedStation,
                                                    stationData,
                                                )}
                                            </h2>

                                            <p className="mt-1 text-[10px] text-slate-400">
                                                {
                                                    selectedStation
                                                }{" "}
                                                • Live railway services
                                            </p>
                                        </div>

                                        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
                                            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300">
                                                Services
                                            </p>

                                            <p className="mt-1 text-lg font-extrabold text-slate-800">
                                                {
                                                    stationData?.total_trains ??
                                                    0
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-[1fr_64px_70px] border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[8px] font-extrabold uppercase tracking-[.18em] text-slate-300">
                                    <span>
                                        Train
                                    </span>

                                    <span className="text-right">
                                        Time
                                    </span>

                                    <span className="text-right">
                                        Delay
                                    </span>
                                </div>

                                {loadingStation && (
                                    <div className="space-y-2 p-3">
                                        {Array.from(
                                            {
                                                length: 7,
                                            },
                                        ).map(
                                            (
                                                _,
                                                index,
                                            ) => (
                                                <div
                                                    key={
                                                        index
                                                    }
                                                    className="skeleton h-[82px] rounded-2xl"
                                                />
                                            ),
                                        )}
                                    </div>
                                )}

                                {!loadingStation &&
                                    filteredTrains.length ===
                                        0 && (
                                        <div className="px-6 py-16 text-center">
                                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-xl text-slate-300">
                                                ⌕
                                            </div>

                                            <p className="mt-4 text-sm font-bold text-slate-600">
                                                No trains found
                                            </p>

                                            <p className="mt-1 text-xs text-slate-400">
                                                Try another train number or destination.
                                            </p>
                                        </div>
                                    )}

                                {!loadingStation &&
                                    filteredTrains.length >
                                        0 && (
                                        <div className="max-h-[760px] space-y-1.5 overflow-y-auto p-2.5 scrollbar-thin">
                                            {filteredTrains.map(
                                                (
                                                    train: any,
                                                    index: number,
                                                ) => {
                                                    const number =
                                                        normalizeTrainNumber(
                                                            train?.train_no,
                                                        );

                                                    const selected =
                                                        selectedTrain ===
                                                        number;

                                                    const delay =
                                                        Number(
                                                            train?.arrival_delay ??
                                                                train?.departure_delay ??
                                                                0,
                                                        );

                                                    return (
                                                        <button
                                                            key={`${number}-${index}`}
                                                            type="button"
                                                            onClick={() =>
                                                                void handleTrainClick(
                                                                    train,
                                                                )
                                                            }
                                                            style={{
                                                                animationDelay: `${Math.min(index, 8) * 35}ms`,
                                                            }}
                                                            className={`slide-up group relative w-full overflow-hidden rounded-2xl border p-3.5 text-left transition-all ${
                                                                selected
                                                                    ? "border-blue-200 bg-blue-50/80 shadow-md shadow-blue-100"
                                                                    : "border-transparent bg-white hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50"
                                                            }`}
                                                        >
                                                            {selected && (
                                                                <div className="absolute bottom-0 left-0 top-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-400" />
                                                            )}

                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-extrabold text-slate-800">
                                                                            {
                                                                                number
                                                                            }
                                                                        </span>

                                                                        {selected && (
                                                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[7px] font-extrabold uppercase tracking-wider text-blue-600">
                                                                                Selected
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <p className="mt-1 truncate text-[10px] text-slate-400">
                                                                        {train?.train_name ||
                                                                            "Rail service"}
                                                                    </p>

                                                                    <p className="mt-1 truncate text-[9px] text-slate-300">
                                                                        {train?.source_name ||
                                                                            train?.source ||
                                                                            "Unknown"}{" "}
                                                                        →
                                                                        {train?.destination_name ||
                                                                            train?.destination ||
                                                                            "Unknown"}
                                                                    </p>
                                                                </div>

                                                                <div className="shrink-0 text-right">
                                                                    <p className="text-base font-extrabold text-slate-800">
                                                                        {train?.eta ||
                                                                            train?.etd ||
                                                                            train?.scheduled_arrival ||
                                                                            "—"}
                                                                    </p>

                                                                    <p className="mt-1 text-[8px] font-bold text-slate-300">
                                                                        PF{" "}
                                                                        {train?.platform ||
                                                                            "—"}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                                                                <span className="text-[8px] font-bold uppercase tracking-[.16em] text-slate-300">
                                                                    {train?.train_type ||
                                                                        "Passenger"}
                                                                </span>

                                                                <span
                                                                    className={`rounded-full border px-2.5 py-1 text-[8px] font-extrabold ${delayBadgeClass(
                                                                        delay,
                                                                    )}`}
                                                                >
                                                                    {formatDelay(
                                                                        delay,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                },
                                            )}
                                        </div>
                                    )}

                                <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                                    <div className="flex items-center justify-between text-[8px] font-bold text-slate-300">
                                        <span>
                                            SOURCE:{" "}
                                            {
                                                sourceLabel
                                            }
                                        </span>

                                        <span>
                                            {lastUpdated
                                                ? `UPDATED ${lastUpdated}`
                                                : "WAITING"}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            {/* =================================================
                                TRAIN INTELLIGENCE
                            ================================================= */}

                            <section
                                className={`${
                                    mobileTab ===
                                    "board"
                                        ? "hidden lg:block"
                                        : ""
                                } space-y-5`}
                            >
                                {/* NO TRAIN */}
                                {!selectedTrain && (
                                    <section className="relative flex min-h-[580px] items-center justify-center overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,.06)]">
                                        <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/60 blur-[100px]" />

                                        <div className="relative max-w-lg px-8 text-center">
                                            <div className="rail-float mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-blue-600 to-cyan-500 text-4xl text-white shadow-xl shadow-blue-200">
                                                🚆
                                            </div>

                                            <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[.25em] text-blue-600">
                                                RailSaathi Intelligence
                                            </p>

                                            <h2 className="mt-3 text-3xl font-extrabold text-slate-900">
                                                Select a train
                                            </h2>

                                            <p className="mt-3 text-sm leading-7 text-slate-400">
                                                Choose a service from the live station board to see its current railway status, ETA prediction and AI insights.
                                            </p>

                                            <div className="mt-7 grid grid-cols-3 gap-2">
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-xl text-blue-500">
                                                        ◉
                                                    </p>

                                                    <p className="mt-2 text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                                                        Live
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-xl text-indigo-500">
                                                        ◇
                                                    </p>

                                                    <p className="mt-2 text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                                                        Predict
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <p className="text-xl text-cyan-500">
                                                        ✦
                                                    </p>

                                                    <p className="mt-2 text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                                                        Explain
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* SELECTED TRAIN */}
                                {selectedTrain && (
                                    <>
                                        {/* TRAIN HEADER */}
                                        <section className="slide-up overflow-hidden rounded-[34px] border border-blue-100 bg-gradient-to-br from-white via-blue-50/40 to-cyan-50/50 p-6 shadow-[0_20px_70px_rgba(37,99,235,.08)] sm:p-7">
                                            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                                                <div>
                                                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[8px] font-extrabold uppercase tracking-[.18em] text-blue-600">
                                                        Train intelligence
                                                    </span>

                                                    <h2 className="mt-4 text-5xl font-extrabold tracking-[-.05em] text-slate-900 sm:text-6xl">
                                                        {
                                                            selectedTrain
                                                        }
                                                    </h2>

                                                    <p className="mt-2 text-lg font-semibold text-slate-400">
                                                        {
                                                            trainName
                                                        }
                                                    </p>

                                                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                                        <span>
                                                            {selectedBoardTrain?.source_name ||
                                                                "Origin"}
                                                        </span>

                                                        <span className="font-bold text-blue-500">
                                                            →
                                                        </span>

                                                        <span>
                                                            {destinationStation?.station_name ||
                                                                selectedBoardTrain?.destination_name ||
                                                                "Destination"}
                                                        </span>
                                                    </div>

                                                    <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-[9px] font-bold text-blue-600 shadow-sm">
                                                        <span className="soft-pulse h-2 w-2 rounded-full bg-blue-500" />

                                                        Monitoring:{" "}
                                                        {
                                                            getStationName(
                                                                selectedStation,
                                                                stationData,
                                                            )
                                                        }{" "}
                                                        (
                                                        {
                                                            selectedStation
                                                        }
                                                        )
                                                    </div>
                                                </div>

                                                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                                    <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-slate-400">
                                                        Current delay
                                                    </p>

                                                    <div className="mt-2 flex items-baseline gap-2">
                                                        <span
                                                            className={`text-5xl font-extrabold ${delayClass(
                                                                currentDelay,
                                                            )}`}
                                                        >
                                                            {currentDelay >
                                                            0
                                                                ? "+"
                                                                : ""}
                                                            {Math.round(
                                                                currentDelay,
                                                            )}
                                                        </span>

                                                        <span className="text-sm text-slate-300">
                                                            min
                                                        </span>
                                                    </div>

                                                    <p
                                                        className={`mt-2 text-[9px] font-extrabold uppercase tracking-[.18em] ${delayClass(
                                                            currentDelay,
                                                        )}`}
                                                    >
                                                        {delayLabel(
                                                            currentDelay,
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-7 grid gap-3 sm:grid-cols-3">
                                                <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                                                    <p className="text-[8px] font-extrabold uppercase tracking-[.18em] text-slate-400">
                                                        Current location
                                                    </p>

                                                    <p className="mt-2 truncate text-sm font-extrabold text-slate-800">
                                                        {
                                                            currentStationName
                                                        }
                                                    </p>

                                                    <p className="mt-1 text-[9px] text-slate-400">
                                                        {
                                                            current
                                                        }
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                    <p className="text-[8px] font-extrabold uppercase tracking-[.18em] text-slate-400">
                                                        Next station
                                                    </p>

                                                    <p className="mt-2 truncate text-sm font-extrabold text-slate-800">
                                                        {nextStation?.station_name ||
                                                            "Unavailable"}
                                                    </p>

                                                    <p className="mt-1 text-[9px] text-slate-400">
                                                        {nextStation?.station_code ||
                                                            "—"}
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                    <p className="text-[8px] font-extrabold uppercase tracking-[.18em] text-slate-400">
                                                        Destination
                                                    </p>

                                                    <p className="mt-2 truncate text-sm font-extrabold text-slate-800">
                                                        {destinationStation?.station_name ||
                                                            selectedBoardTrain?.destination_name ||
                                                            "Unavailable"}
                                                    </p>

                                                    <p className="mt-1 text-[9px] text-slate-400">
                                                        {destinationStation?.station_code ||
                                                            selectedBoardTrain?.destination ||
                                                            "—"}
                                                    </p>
                                                </div>
                                            </div>
                                        </section>

                                        {/* WEATHER */}
                                        <section className="slide-up rounded-[30px] border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-5 shadow-sm sm:p-6">
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                                                        ☁️
                                                    </div>

                                                    <div>
                                                        <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-sky-600">
                                                            Weather intelligence
                                                        </p>

                                                        <h3 className="mt-1 text-lg font-extrabold text-slate-800">
                                                            Weather details unavailable
                                                        </h3>

                                                        <p className="mt-1 text-xs text-slate-400">
                                                            Weather feed is not connected to the current demo environment.
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                                                    NOT AVAILABLE
                                                </span>
                                            </div>

                                            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                                {[
                                                    "Temperature",
                                                    "Rain",
                                                    "Visibility",
                                                ].map(
                                                    (
                                                        item,
                                                    ) => (
                                                        <div
                                                            key={
                                                                item
                                                            }
                                                            className="rounded-2xl border border-sky-100 bg-white/80 p-4"
                                                        >
                                                            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300">
                                                                {
                                                                    item
                                                                }
                                                            </p>

                                                            <p className="mt-2 text-lg font-extrabold text-slate-400">
                                                                —
                                                            </p>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </section>

                                        {/* ERROR */}
                                        {selectedTrainError && (
                                            <section className="slide-up rounded-[28px] border border-amber-200 bg-amber-50 p-5">
                                                <div className="flex gap-4">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-500">
                                                        !
                                                    </div>

                                                    <div>
                                                        <p className="text-sm font-extrabold text-amber-700">
                                                            Railway data temporarily unavailable
                                                        </p>

                                                        <p className="mt-1 text-xs leading-5 text-amber-600/70">
                                                            {
                                                                selectedTrainError
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </section>
                                        )}

                                        {/* ETA CARD */}
                                        {payload?.predictions?.[0] && (
                                            <section className="slide-up rounded-[30px] border border-blue-100 bg-white p-6 shadow-sm">
                                                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                                    <div>
                                                        <p className="text-[9px] font-extrabold uppercase tracking-[.22em] text-blue-600">
                                                            Predictive ETA
                                                        </p>

                                                        <h3 className="mt-2 text-3xl font-extrabold text-slate-900">
                                                            {formatClock(
                                                                payload
                                                                    .predictions[0]
                                                                    ?.eta,
                                                            )}
                                                        </h3>

                                                        <p className="mt-2 text-xs text-slate-400">
                                                            Predicted arrival at{" "}
                                                            {payload
                                                                .predictions[0]
                                                                ?.station
                                                                ?.name ||
                                                                "next station"}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl bg-blue-50 px-6 py-4 text-center">
                                                        <p className="text-[8px] font-extrabold uppercase tracking-widest text-blue-400">
                                                            Predicted delay
                                                        </p>

                                                        <p
                                                            className={`mt-1 text-2xl font-extrabold ${delayClass(
                                                                payload
                                                                    .predictions[0]
                                                                    ?.delay_minutes,
                                                            )}`}
                                                        >
                                                            {formatDelay(
                                                                payload
                                                                    .predictions[0]
                                                                    ?.delay_minutes,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </section>
                                        )}

                                        {/* JOURNEY PROGRESS */}
                                        {routeStations.length >
                                            0 && (
                                            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                                <div className="flex items-end justify-between gap-4">
                                                    <div>
                                                        <p className="text-[9px] font-extrabold uppercase tracking-[.22em] text-slate-400">
                                                            Journey progress
                                                        </p>

                                                        <h3 className="mt-2 text-xl font-extrabold text-slate-800">
                                                            {
                                                                currentStationName
                                                            }
                                                        </h3>

                                                        <p className="mt-1 text-[10px] text-slate-400">
                                                            {Math.round(
                                                                currentDistance,
                                                            )}{" "}
                                                            km of{" "}
                                                            {Math.round(
                                                                totalDistance,
                                                            )}{" "}
                                                            km
                                                        </p>
                                                    </div>

                                                    <p className="text-4xl font-extrabold text-blue-600">
                                                        {Math.round(
                                                            progress,
                                                        )}
                                                        %
                                                    </p>
                                                </div>

                                                <div className="relative mt-7">
                                                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-1000"
                                                            style={{
                                                                width: `${progress}%`,
                                                            }}
                                                        />
                                                    </div>

                                                    <div
                                                        className="soft-pulse absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-cyan-500 shadow-lg"
                                                        style={{
                                                            left: `${progress}%`,
                                                        }}
                                                    />
                                                </div>

                                                <div className="mt-3 flex justify-between text-[9px] font-semibold text-slate-300">
                                                    <span>
                                                        Origin
                                                    </span>

                                                    <span>
                                                        Destination
                                                    </span>
                                                </div>
                                            </section>
                                        )}

                                        {/* =================================================
                                            FIXED UPCOMING STATIONS
                                            
                                            THIS IS THE IMPORTANT FIX.
                                            
                                            No min-height.
                                            No justify-between.
                                            No huge empty space.
                                            Stations render immediately.
                                        ================================================= */}

                                        {routeStations.length >
                                            0 && (
                                            <section className="slide-up overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
                                                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <p className="text-[9px] font-extrabold uppercase tracking-[.22em] text-blue-500">
                                                                Route intelligence
                                                            </p>

                                                            <h3 className="mt-1 text-xl font-extrabold text-slate-800">
                                                                Upcoming stations
                                                            </h3>

                                                            <p className="mt-1 text-xs text-slate-400">
                                                                Live route position and predicted arrival timings
                                                            </p>
                                                        </div>

                                                        <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[8px] font-extrabold uppercase tracking-wider text-blue-600">
                                                            FORECAST
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* COMPACT TIMELINE */}
                                                <div className="px-5 py-5 sm:px-6">
                                                    {upcomingStations.length ===
                                                        0 && (
                                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                                                            <p className="text-sm font-bold text-slate-500">
                                                                Route information unavailable
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-400">
                                                                RailSaathi could not load the station sequence for this train.
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="space-y-3">
                                                        {upcomingStations.map(
                                                            (
                                                                item,
                                                                index,
                                                            ) => {
                                                                const station =
                                                                    item.station;

                                                                const prediction =
                                                                    item.prediction;

                                                                const code =
                                                                    safeString(
                                                                        station?.station_code,
                                                                    ).toUpperCase();

                                                                const delay =
                                                                    prediction
                                                                        ? Number(
                                                                              prediction?.delay_minutes ??
                                                                                  0,
                                                                          )
                                                                        : Number(
                                                                              station?.arrival_delay ??
                                                                                  station?.departure_delay ??
                                                                                  0,
                                                                          );

                                                                const scheduled =
                                                                    station?.scheduled_arrival ||
                                                                    station?.sta ||
                                                                    null;

                                                                const predicted =
                                                                    prediction?.eta ||
                                                                    null;

                                                                return (
                                                                    <div
                                                                        key={`${code}-${index}`}
                                                                        className={`relative flex gap-4 rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                                                                            item.isCurrent
                                                                                ? "border-blue-200 bg-blue-50/60"
                                                                                : "border-slate-100 bg-white"
                                                                        }`}
                                                                    >
                                                                        {/* LINE */}
                                                                        <div className="relative flex w-7 shrink-0 justify-center">
                                                                            {index <
                                                                                upcomingStations.length -
                                                                                    1 && (
                                                                                <div className="absolute left-1/2 top-7 h-[calc(100%+12px)] w-px -translate-x-1/2 bg-slate-200" />
                                                                            )}

                                                                            <div
                                                                                className={`relative z-10 mt-1 h-4 w-4 rounded-full border-4 border-white shadow-sm ${
                                                                                    item.isCurrent
                                                                                        ? "bg-blue-500 shadow-blue-200"
                                                                                        : "bg-slate-300"
                                                                                }`}
                                                                            />
                                                                        </div>

                                                                        {/* STATION */}
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                                <div className="min-w-0">
                                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                                        <h4 className="truncate text-sm font-extrabold text-slate-800">
                                                                                            {station?.station_name ||
                                                                                                code ||
                                                                                                "Unknown station"}
                                                                                        </h4>

                                                                                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[8px] font-extrabold text-slate-400">
                                                                                            {
                                                                                                code
                                                                                            }
                                                                                        </span>

                                                                                        {item.isCurrent && (
                                                                                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[7px] font-extrabold uppercase tracking-wider text-blue-600">
                                                                                                CURRENT
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    <p className="mt-1 text-[9px] text-slate-400">
                                                                                        {station?.distance !=
                                                                                        null
                                                                                            ? `${Math.round(Number(station.distance))} km from origin`
                                                                                            : "Railway station"}
                                                                                    </p>
                                                                                </div>

                                                                                <div className="shrink-0 sm:text-right">
                                                                                    <p className="text-[8px] font-extrabold uppercase tracking-wider text-slate-300">
                                                                                        Predicted
                                                                                    </p>

                                                                                    <p className="mt-1 text-lg font-extrabold text-blue-600">
                                                                                        {formatClock(
                                                                                            predicted ||
                                                                                                scheduled,
                                                                                        )}
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                                                                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                                                                    <p className="text-[7px] font-extrabold uppercase tracking-wider text-slate-300">
                                                                                        Scheduled
                                                                                    </p>

                                                                                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                                                                                        {formatClock(
                                                                                            scheduled,
                                                                                        )}
                                                                                    </p>
                                                                                </div>

                                                                                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                                                                    <p className="text-[7px] font-extrabold uppercase tracking-wider text-slate-300">
                                                                                        Delay
                                                                                    </p>

                                                                                    <p
                                                                                        className={`mt-1 text-[11px] font-extrabold ${delayClass(
                                                                                            delay,
                                                                                        )}`}
                                                                                    >
                                                                                        {formatDelay(
                                                                                            delay,
                                                                                        )}
                                                                                    </p>
                                                                                </div>

                                                                                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                                                                    <p className="text-[7px] font-extrabold uppercase tracking-wider text-slate-300">
                                                                                        Status
                                                                                    </p>

                                                                                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                                                                                        {item.isCurrent
                                                                                            ? "Train here"
                                                                                            : prediction
                                                                                              ? "Predicted"
                                                                                              : "Scheduled"}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>
                                            </section>
                                        )}

                                        {/* AI INSIGHT */}
                                        <section className="slide-up overflow-hidden rounded-[30px] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 shadow-sm sm:p-6">
                                            <div className="flex items-start gap-4">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-xl text-indigo-600">
                                                    ✦
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-extrabold uppercase tracking-[.22em] text-indigo-600">
                                                        AI prediction engine
                                                    </p>

                                                    <h3 className="mt-1 text-xl font-extrabold text-slate-800">
                                                        Why this prediction?
                                                    </h3>

                                                    <div className="mt-4 rounded-2xl border border-indigo-100 bg-white p-4">
                                                        <p className="text-sm leading-7 text-slate-600">
                                                            {payload?.insight ||
                                                                (currentDelay >
                                                                5
                                                                    ? `The train is currently ${Math.round(
                                                                          currentDelay,
                                                                      )} minutes late. RailSaathi evaluates the current delay and downstream operating conditions to estimate how much of that delay may propagate.`
                                                                    : "The train is currently operating close to schedule. RailSaathi expects limited downstream delay variation based on the current operating state.")}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                                <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300">
                                                        Current
                                                    </p>

                                                    <p
                                                        className={`mt-2 text-lg font-extrabold ${delayClass(
                                                            currentDelay,
                                                        )}`}
                                                    >
                                                        {currentDelay >
                                                        0
                                                            ? "+"
                                                            : ""}
                                                        {Math.round(
                                                            currentDelay,
                                                        )}
                                                        m
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300">
                                                        Expected change
                                                    </p>

                                                    <p
                                                        className={`mt-2 text-lg font-extrabold ${delayClass(
                                                            delayChange,
                                                        )}`}
                                                    >
                                                        {delayChange >=
                                                        0
                                                            ? "+"
                                                            : ""}
                                                        {Math.round(
                                                            delayChange,
                                                        )}
                                                        m
                                                    </p>
                                                </div>

                                                <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-300">
                                                        Confidence
                                                    </p>

                                                    <p className="mt-2 text-lg font-extrabold text-indigo-600">
                                                        {payload?.model_confidence ??
                                                            "—"}
                                                        <span className="ml-1 text-xs font-normal text-slate-300">
                                                            %
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        </section>

                                        {/* DATA PIPELINE */}
                                        <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-[8px] font-extrabold uppercase tracking-[.22em] text-slate-300">
                                                        RailSaathi data pipeline
                                                    </p>

                                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-bold text-slate-400">
                                                        <span className="rounded-lg bg-slate-50 px-2 py-1">
                                                            NTES
                                                        </span>

                                                        <span className="text-blue-500">
                                                            →
                                                        </span>

                                                        <span className="rounded-lg bg-slate-50 px-2 py-1">
                                                            Live State
                                                        </span>

                                                        <span className="text-blue-500">
                                                            →
                                                        </span>

                                                        <span className="rounded-lg bg-indigo-50 px-2 py-1 text-indigo-500">
                                                            ML Engine
                                                        </span>

                                                        <span className="text-blue-500">
                                                            →
                                                        </span>

                                                        <span className="rounded-lg bg-cyan-50 px-2 py-1 text-cyan-600">
                                                            ETA
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-left sm:text-right">
                                                    <span
                                                        className={`inline-flex rounded-full border px-3 py-1.5 text-[8px] font-extrabold ${sourceClass}`}
                                                    >
                                                        {
                                                            sourceLabel
                                                        }
                                                    </span>

                                                    {lastUpdated && (
                                                        <p className="mt-2 text-[8px] text-slate-300">
                                                            Last update{" "}
                                                            {
                                                                lastUpdated
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    </>
                                )}
                            </section>
                        </div>

                        {/* =================================================
                            WEATHER FOOTER
                        ================================================= */}

                        <section className="mt-5 rounded-[28px] border border-sky-100 bg-white p-5 shadow-[0_14px_45px_rgba(43,76,120,.07)]">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-2xl">
                                        ☁️
                                    </div>

                                    <div>
                                        <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-sky-600">
                                            Weather intelligence
                                        </p>

                                        <h3 className="mt-1 text-sm font-black text-slate-800">
                                            Weather details unavailable
                                        </h3>

                                        <p className="mt-1 text-xs text-slate-400">
                                            Weather data is not connected to the current demo environment.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid flex-1 gap-2 sm:grid-cols-3 lg:max-w-[620px]">
                                    <div className="rounded-2xl bg-slate-50 p-3">
                                        <p className="text-[8px] font-black uppercase tracking-wider text-slate-300">
                                            Temperature
                                        </p>

                                        <p className="mt-2 text-sm font-black text-slate-400">
                                            —
                                        </p>
                                    </div>

                                    <div className="rounded-2xl bg-slate-50 p-3">
                                        <p className="text-[8px] font-black uppercase tracking-wider text-slate-300">
                                            Rain
                                        </p>

                                        <p className="mt-2 text-sm font-black text-slate-400">
                                            —
                                        </p>
                                    </div>

                                    <div className="rounded-2xl bg-slate-50 p-3">
                                        <p className="text-[8px] font-black uppercase tracking-wider text-slate-300">
                                            Visibility
                                        </p>

                                        <p className="mt-2 text-sm font-black text-slate-400">
                                            —
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-dashed border-sky-200 bg-sky-50/50 px-3 py-2.5 text-center text-[9px] font-bold text-sky-500">
                                WEATHER DETAILS UNAVAILABLE
                            </div>
                        </section>
                    </>
                )}

                {/* =================================================
                    FOOTER
                ================================================= */}

                <footer className="px-2 py-6 text-center">
                    <p className="text-[10px] font-bold tracking-wide text-slate-400">
                        RAILSAATHI • Smarter Journeys • Safer Tomorrows
                    </p>
                </footer>
            </div>
        </main>
    );
}