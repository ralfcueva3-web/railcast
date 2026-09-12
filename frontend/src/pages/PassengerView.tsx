import {
    useEffect,
    useState,
} from "react";

import {
    getETA,
    getStationTrains,
    getTrainStatus,
    getTrainRoute,
} from "../api/trainApi";

import type {
    ETAResponse,
    ETAPrediction,
} from "../types";

import type {
    StationTrain,
    StationTrainsResponse,
} from "../api/trainApi";

import { stations } from "../data/route";

import ETACard from "../components/ETACard";
import StationTimeline from "../components/StationTimeline";
import TrainMap from "../components/TrainMap";
import MLInsightCard from "../components/MLInsightCard";


export default function PassengerView() {

    // =========================================================
    // STATION STATE
    // =========================================================

    const [stationInput, setStationInput] =
        useState("");

    const [selectedStation, setSelectedStation] =
        useState("");

    const [stationData, setStationData] =
        useState<StationTrainsResponse | null>(
            null
        );

    // =========================================================
    // TRAIN STATE
    // =========================================================

    const [selectedTrain, setSelectedTrain] =
        useState<string | null>(null);

    const [selectedTrainStatus, setSelectedTrainStatus] =
        useState<any>(null);

    const [selectedTrainRoute, setSelectedTrainRoute] =
        useState<any>(null);

    const [selectedTrainError, setSelectedTrainError] =
        useState<string | null>(null);

    const [payload, setPayload] =
        useState<ETAResponse | null>(null);

    // =========================================================
    // LOADING
    // =========================================================

    const [loadingStation, setLoadingStation] =
        useState(false);

    const [loadingTrain, setLoadingTrain] =
        useState(false);

    // =========================================================
    // LAST UPDATED
    // =========================================================

    const [lastUpdated, setLastUpdated] =
        useState<string | null>(null);

    // =========================================================
    // DATE HELPER
    // =========================================================

    const getTodayNTESDate = () => {

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

        return `${String(
            now.getDate()
        ).padStart(2, "0")}-${months[
        now.getMonth()
        ]}-${now.getFullYear()}`;
    };

    // =========================================================
    // TIME HELPER
    // =========================================================

    const updateLastUpdated = () => {

        setLastUpdated(
            new Date().toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                }
            )
        );
    };

    // =========================================================
    // LOAD STATION BOARD
    // =========================================================

    useEffect(() => {

        if (!selectedStation) {
            return;
        }

        let cancelled = false;

        const loadStation = async () => {

            setLoadingStation(true);

            setSelectedTrain(null);
            setSelectedTrainStatus(null);
            setSelectedTrainRoute(null);
            setSelectedTrainError(null);
            setPayload(null);

            try {

                const data =
                    await getStationTrains(
                        selectedStation
                    );

                if (cancelled) {
                    return;
                }

                console.log(
                    "SELECTED STATION DATA:",
                    data
                );

                setStationData(data);

                updateLastUpdated();

            } catch (error) {

                if (cancelled) {
                    return;
                }

                console.error(
                    "Failed to load station data:",
                    error
                );

                setStationData(null);

                setSelectedTrainError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load station data"
                );

            } finally {

                if (!cancelled) {
                    setLoadingStation(false);
                }
            }
        };

        loadStation();

        return () => {
            cancelled = true;
        };

    }, [selectedStation]);

    // =========================================================
    // AUTO REFRESH STATION BOARD
    // =========================================================

    useEffect(() => {

        if (!selectedStation) {
            return;
        }

        let cancelled = false;

        const refreshStationBoard =
            async () => {

                try {

                    const data =
                        await getStationTrains(
                            selectedStation
                        );

                    if (cancelled) {
                        return;
                    }

                    console.log(
                        "AUTO REFRESH STATION BOARD:",
                        data
                    );

                    setStationData(data);

                    updateLastUpdated();

                } catch (error) {

                    console.error(
                        "Automatic station refresh failed:",
                        error
                    );
                }
            };

        const intervalId =
            window.setInterval(
                refreshStationBoard,
                60_000
            );

        return () => {

            cancelled = true;

            window.clearInterval(
                intervalId
            );
        };

    }, [selectedStation]);

    // =========================================================
    // SEARCH STATION
    // =========================================================

    const handleStationSearch = () => {

        const code =
            stationInput
                .trim()
                .toUpperCase();

        if (!code) {
            return;
        }

        setSelectedStation(code);
    };

    const handleStationKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {

        if (event.key === "Enter") {
            handleStationSearch();
        }
    };

    const getCorrectCurrentStation = (
        routeData: any,
        statusData: any
    ): string => {

        // =====================================================
        // ROUTE DATA
        // =====================================================

        const routeStations =
            Array.isArray(routeData?.route)
                ? routeData.route
                : [];

        const normalizedRoute =
            routeStations.map(
                (station: any) => ({
                    code: String(
                        station?.station_code ||
                        station?.code ||
                        ""
                    )
                        .trim()
                        .toUpperCase(),

                    name: String(
                        station?.station_name ||
                        station?.name ||
                        ""
                    ).trim(),
                })
            );

        const firstCode =
            normalizedRoute[0]?.code || "";

        // =====================================================
        // TRAIN NOT STARTED
        // =====================================================

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
            statusText.includes("yet to start") ||
            statusText.includes("not started");

        if (
            notStarted &&
            firstCode
        ) {
            return firstCode;
        }

        // =====================================================
        // 1. BACKEND CURRENT STATION
        // =====================================================
        //
        // IMPORTANT:
        // The backend has already processed NTES data.
        // Prefer its normalized current_station value.
        //

        const backendCurrent =
            String(
                routeData?.current_station ||
                ""
            )
                .trim()
                .toUpperCase();

        if (backendCurrent) {
            return backendCurrent;
        }

        // =====================================================
        // 2. CPOS
        // =====================================================
        //
        // CPOS can contain the most recent physical position.
        // Use it only when backend current_station is unavailable.
        //

        const cpos =
            String(
                statusData?.CPOS ||
                ""
            ).trim();

        if (cpos) {

            const match =
                cpos.match(
                    /\(([A-Za-z0-9]{2,6})\)/
                );

            if (match?.[1]) {

                const cposCode =
                    String(
                        match[1]
                    )
                        .trim()
                        .toUpperCase();

                if (cposCode) {
                    return cposCode;
                }
            }
        }

        // =====================================================
        // 3. LSTN
        // =====================================================

        const lstn =
            String(
                statusData?.LSTN ||
                ""
            )
                .trim()
                .toUpperCase();

        if (
            lstn &&
            normalizedRoute.some(
                (station: any) =>
                    station.code === lstn
            )
        ) {
            return lstn;
        }

        // =====================================================
        // 4. ISA
        // =====================================================

        const currentFlagStation =
            routeStations.find(
                (station: any) =>
                    station?.is_current === true
            );

        if (currentFlagStation) {

            const code =
                String(
                    currentFlagStation?.station_code ||
                    currentFlagStation?.code ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            if (code) {
                return code;
            }
        }

        // =====================================================
        // 5. LATEST VISITED STATION
        // =====================================================

        const visitedStations =
            routeStations.filter(
                (station: any) =>
                    station?.actual_arrival ||
                    station?.actual_departure
            );

        if (
            visitedStations.length > 0
        ) {

            const latest =
                visitedStations[
                visitedStations.length - 1
                ];

            const code =
                String(
                    latest?.station_code ||
                    latest?.code ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            if (code) {
                return code;
            }
        }

        // =====================================================
        // 6. SELECTED STATION FALLBACK
        // =====================================================

        return String(
            selectedStation || ""
        )
            .trim()
            .toUpperCase();
    };

    // =========================================================
    // CPOS NAME
    // =========================================================

    const extractCposStationName = (
        cpos: string,
        code: string
    ): string => {

        if (!cpos || !code) {
            return "";
        }

        const match =
            cpos.match(
                /(?:from|at)\s+(.+?)\(([A-Za-z0-9]{2,6})\)/i
            );

        if (!match) {
            return "";
        }

        const extractedCode =
            String(match[2] || "")
                .trim()
                .toUpperCase();

        if (
            extractedCode !==
            code.trim().toUpperCase()
        ) {
            return "";
        }

        return (
            match[1]?.trim() || ""
        );
    };

    // =========================================================
    // TRAIN CLICK
    // =========================================================

    const handleTrainClick = async (
        train: StationTrain
    ) => {

        const trainNumber =
            String(
                train.train_no
            ).trim();

        if (!trainNumber) {
            return;
        }

        setSelectedTrain(
            trainNumber
        );

        setSelectedTrainStatus(null);
        setSelectedTrainRoute(null);
        setSelectedTrainError(null);
        setPayload(null);

        setLoadingTrain(true);

        try {

            const today =
                getTodayNTESDate();

            // -------------------------------------------------
            // LIVE STATUS
            // -------------------------------------------------

            const status =
                await getTrainStatus(
                    trainNumber,
                    today
                );

            console.log(
                "SELECTED TRAIN STATUS:",
                status
            );

            // -------------------------------------------------
            // ROUTE
            // -------------------------------------------------

            const route =
                await getTrainRoute(
                    trainNumber,
                    today
                );

            console.log(
                "SELECTED TRAIN ROUTE:",
                route
            );

            // -------------------------------------------------
            // CURRENT STATION
            // -------------------------------------------------

            const currentStation =
                getCorrectCurrentStation(
                    route,
                    status
                );

            console.log(
                "CORRECT CURRENT STATION:",
                currentStation
            );

            // -------------------------------------------------
            // RAILDRISHTI ETA
            // -------------------------------------------------

            const eta =
                await getETA(
                    trainNumber,
                    currentStation
                );

            console.log(
                "RailDrishti ETA:",
                eta
            );

            setSelectedTrainStatus(
                status
            );

            setSelectedTrainRoute(
                route
            );

            setPayload(
                eta
            );

            setSelectedTrainError(
                null
            );

            updateLastUpdated();

        } catch (error) {

            console.error(
                "Selected train request failed:",
                error
            );

            setPayload(null);

            setSelectedTrainError(
                error instanceof Error
                    ? error.message
                    : "Failed to fetch live train data"
            );

        } finally {

            setLoadingTrain(false);
        }
    };

    // =========================================================
    // AUTO REFRESH SELECTED TRAIN
    // =========================================================

    useEffect(() => {

        if (!selectedTrain) {
            return;
        }

        let cancelled = false;

        const refreshSelectedTrain =
            async () => {

                try {

                    const today =
                        getTodayNTESDate();

                    const status =
                        await getTrainStatus(
                            selectedTrain,
                            today
                        );

                    if (cancelled) {
                        return;
                    }

                    const route =
                        await getTrainRoute(
                            selectedTrain,
                            today
                        );

                    if (cancelled) {
                        return;
                    }

                    const currentStation =
                        getCorrectCurrentStation(
                            route,
                            status
                        );

                    const eta =
                        await getETA(
                            selectedTrain,
                            currentStation
                        );

                    if (cancelled) {
                        return;
                    }

                    console.log(
                        "AUTO REFRESH CURRENT:",
                        currentStation
                    );

                    console.log(
                        "AUTO REFRESH ETA:",
                        eta
                    );

                    setSelectedTrainStatus(
                        status
                    );

                    setSelectedTrainRoute(
                        route
                    );

                    setPayload(
                        eta
                    );

                    setSelectedTrainError(
                        null
                    );

                    updateLastUpdated();

                } catch (error) {

                    console.error(
                        "Automatic train refresh failed:",
                        error
                    );
                }
            };

        const intervalId =
            window.setInterval(
                refreshSelectedTrain,
                60_000
            );

        return () => {

            cancelled = true;

            window.clearInterval(
                intervalId
            );
        };

    }, [selectedTrain]);

    // =========================================================
    // AUTHORITATIVE CURRENT STATION
    // =========================================================

    const current =
        String(
            payload?.current_station ||
            selectedTrainRoute?.current_station ||
            ""
        )
            .trim()
            .toUpperCase() ||
        getCorrectCurrentStation(
            selectedTrainRoute,
            selectedTrainStatus
        );

    // =========================================================
    // ROUTE
    // =========================================================

    const routeStations =
        selectedTrainRoute?.route || [];

    const displayStations =
        routeStations.length > 0
            ? routeStations
            : [];

    // =========================================================
    // CURRENT STATION NAME
    // =========================================================

    const routeCurrentStation =
        routeStations.find(
            (station: any) =>
                String(
                    station?.station_code ||
                    ""
                )
                    .trim()
                    .toUpperCase() ===
                current
        );

    const cposStationName =
        extractCposStationName(
            selectedTrainStatus?.CPOS || "",
            current
        );

    const localStation =
        stations.find(
            (station: any) =>
                String(
                    station?.code || ""
                )
                    .trim()
                    .toUpperCase() ===
                current
        );

    const currentStationName =
        routeCurrentStation?.station_name ||
        cposStationName ||
        localStation?.name ||
        selectedTrainRoute?.current_station_name ||
        selectedTrainStatus?.LSTNN ||
        current;

    // =========================================================
    // ROUTE INDEX
    // =========================================================

    const currentRouteIndex =
        routeStations.findIndex(
            (station: any) =>
                String(
                    station?.station_code ||
                    ""
                )
                    .trim()
                    .toUpperCase() ===
                current
        );

    // =========================================================
    // VISITED STATIONS
    // =========================================================

    const visitedIndexes =
        routeStations
            .map(
                (
                    station: any,
                    index: number
                ) => ({
                    station,
                    index,
                })
            )
            .filter(
                ({
                    station,
                }: any) =>
                    Boolean(
                        station?.actual_arrival ||
                        station?.actual_departure
                    )
            );

    const latestVisitedIndex =
        visitedIndexes.length > 0
            ? visitedIndexes[
                visitedIndexes.length - 1
            ].index
            : -1;

    // =========================================================
    // FIRST UNVISITED STATION
    // =========================================================

    const firstUnvisitedIndex =
        routeStations.findIndex(
            (station: any) =>
                !station?.actual_arrival &&
                !station?.actual_departure
        );

    // =========================================================
    // NEXT STATION
    // =========================================================

    let nextStationIndex = -1;

    if (
        currentRouteIndex >= 0
    ) {

        nextStationIndex =
            currentRouteIndex + 1;

    } else if (
        firstUnvisitedIndex >= 0
    ) {

        nextStationIndex =
            firstUnvisitedIndex;

    } else if (
        latestVisitedIndex >= 0
    ) {

        nextStationIndex =
            latestVisitedIndex + 1;
    }

    const nextRouteStation =
        nextStationIndex >= 0 &&
            nextStationIndex <
            routeStations.length
            ? routeStations[
            nextStationIndex
            ]
            : null;

    // =========================================================
    // DESTINATION
    // =========================================================

    const destinationRouteStation =
        routeStations.length > 0
            ? routeStations[
            routeStations.length - 1
            ]
            : null;

    // =========================================================
    // JOURNEY PROGRESS
    // =========================================================

    const totalDistance =
        routeStations.length > 0
            ? Number(
                routeStations[
                    routeStations.length - 1
                ]?.distance || 0
            )
            : 0;

    let currentDistance = 0;

    if (
        currentRouteIndex >= 0
    ) {

        currentDistance =
            Number(
                routeStations[
                    currentRouteIndex
                ]?.distance || 0
            );

    } else {

        const nextIndex =
            nextStationIndex;

        const previousIndex =
            nextIndex > 0
                ? nextIndex - 1
                : -1;

        if (
            previousIndex >= 0 &&
            nextIndex >= 0 &&
            nextIndex <
            routeStations.length
        ) {

            const previousDistance =
                Number(
                    routeStations[
                        previousIndex
                    ]?.distance || 0
                );

            const nextDistance =
                Number(
                    routeStations[
                        nextIndex
                    ]?.distance ||
                    previousDistance
                );

            currentDistance =
                previousDistance +
                (
                    nextDistance -
                    previousDistance
                ) *
                0.5;

        } else if (
            latestVisitedIndex >= 0
        ) {

            currentDistance =
                Number(
                    routeStations[
                        latestVisitedIndex
                    ]?.distance || 0
                );
        }
    }

    const journeyProgress =
        totalDistance > 0
            ? Math.min(
                99,
                Math.max(
                    0,
                    (
                        currentDistance /
                        totalDistance
                    ) *
                    100
                )
            )
            : 0;

    // =========================================================
    // PREDICTIONS
    // =========================================================

    const predictions =
        payload?.predictions || [];

    const firstPrediction =
        predictions[0] || null;

    const lastPrediction =
        predictions.length > 0
            ? predictions[
            predictions.length - 1
            ]
            : null;

    // =========================================================
    // DELAY
    // =========================================================

    const currentDelay =
        Number(
            payload?.current_delay_minutes ??
            selectedTrainStatus?.LDEL ??
            0
        );

    const finalPredictionDelay =
        lastPrediction
            ? Number(
                lastPrediction.delay_minutes ||
                0
            )
            : currentDelay;

    const delayChange =
        finalPredictionDelay -
        currentDelay;

    // =========================================================
    // STATUS
    // =========================================================

    const statusIntelligence =
        currentDelay > 15
            ? "SIGNIFICANTLY DELAYED"
            : currentDelay > 5
                ? "RUNNING LATE"
                : currentDelay < -2
                    ? "RUNNING EARLY"
                    : "ON TIME";

    // =========================================================
    // STATUS EXPLANATION
    // =========================================================

    const delayTrend =
        finalPredictionDelay >
            currentDelay + 2
            ? "Delay is expected to increase further."
            : finalPredictionDelay <
                currentDelay - 2
                ? "RailDrishti expects the delay to reduce ahead."
                : "Delay is expected to remain broadly stable.";

    const statusExplanation =
        currentDelay > 5
            ? `The train is currently ${Math.round(
                currentDelay
            )} min behind schedule. ${delayTrend}`
            : currentDelay < -2
                ? `The train is currently around ${Math.round(
                    Math.abs(currentDelay)
                )} min ahead of schedule. ${delayTrend}`
                : "The train is currently operating close to its scheduled time.";

    // =========================================================
    // PREDICTION RANGE
    // =========================================================

    const predictionRangeText =
        predictions.length > 0
            ? `${Math.round(
                Math.min(
                    Number(
                        firstPrediction?.delay_minutes ||
                        currentDelay
                    ),
                    finalPredictionDelay
                )
            )}–${Math.round(
                Math.max(
                    Number(
                        firstPrediction?.delay_minutes ||
                        currentDelay
                    ),
                    finalPredictionDelay
                )
            )} min`
            : `${Math.round(
                currentDelay
            )} min`;

    // =========================================================
    // ML EXPLANATION
    // =========================================================

    const mlExplanation =
        currentDelay > 5
            ? delayChange > 2
                ? `The train is already running ${Math.round(
                    currentDelay
                )} min late. RailDrishti expects part of this delay to propagate through downstream segments, increasing the projected delay by around ${Math.round(
                    delayChange
                )} min.`
                : delayChange < -2
                    ? `The train is currently ${Math.round(
                        currentDelay
                    )} min late, but RailDrishti expects the delay to recover by around ${Math.round(
                        Math.abs(delayChange)
                    )} min across the remaining route.`
                    : `The train is currently ${Math.round(
                        currentDelay
                    )} min late. RailDrishti expects the delay to remain broadly stable across the remaining route.`
            : currentDelay < -2
                ? `The train is currently running around ${Math.round(
                    Math.abs(currentDelay)
                )} min early. RailDrishti expects the schedule advantage to gradually normalize downstream.`
                : "The train is currently close to schedule, so RailDrishti expects only limited downstream delay variation.";

    const mlFactors = [
        currentDelay !== 0
            ? `Current upstream delay: ${Math.round(
                currentDelay
            )} min`
            : "Current upstream delay: minimal",

        predictions.length > 0
            ? `Predicted downstream change: ${delayChange >= 0
                ? "+"
                : ""
            }${Math.round(
                delayChange
            )} min`
            : "Predicted downstream change: unavailable",

        "Historical segment behavior",

        "Live operating conditions",
    ];

    // =========================================================
    // DATA SOURCE LABEL
    // =========================================================

    const dataSource =
        stationData?.data_source ||
        "NTES_LIVE";

    const dataSourceLabel =
        dataSource === "NTES_LIVE"
            ? "NTES LIVE"
            : dataSource === "REDIS_CACHE"
                ? "CACHED"
                : dataSource === "DEMO_FALLBACK"
                    ? "DEMO"
                    : "UNAVAILABLE";

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <main className="min-h-screen bg-[#08080F] px-4 py-5 text-white">

            <div className="mx-auto max-w-lg space-y-4">

                {/* =====================================================
                    HEADER
                ===================================================== */}

                <header className="flex items-center justify-between">

                    <div>

                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
                            RailDrishti
                        </p>

                        <h1 className="mt-1 text-xl font-semibold">
                            {selectedTrain
                                ? `${selectedTrain} ${selectedTrainStatus?.TNM ||
                                selectedTrainStatus?.TRAIN_NAME ||
                                "Selected Train"
                                }`
                                : "Live Railway Intelligence"}
                        </h1>

                    </div>

                    <div className="text-right">

                        <span className="inline-flex rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                            ● Live
                        </span>

                        {lastUpdated && (
                            <p className="mt-1 text-[10px] text-white/35">
                                Updated {lastUpdated}
                            </p>
                        )}

                    </div>

                </header>

                {/* =====================================================
                    STATION SEARCH
                ===================================================== */}

                <section className="rounded-3xl border border-blue-400/20 bg-[#12121d] p-5">

                    <p className="text-xs uppercase tracking-widest text-white/40">
                        Search station
                    </p>

                    <div className="mt-3 flex gap-2">

                        <input
                            type="text"
                            value={stationInput}
                            onChange={(event) =>
                                setStationInput(
                                    event.target.value
                                )
                            }
                            onKeyDown={
                                handleStationKeyDown
                            }
                            placeholder="Enter station code e.g. RPH"
                            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0f0f18] px-4 py-3 text-white uppercase outline-none placeholder:text-white/25 focus:border-blue-400/50"
                            maxLength={5}
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
                            className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {loadingStation
                                ? "..."
                                : "Search"}
                        </button>

                    </div>

                    <p className="mt-2 text-xs text-white/30">
                        Enter an Indian Railways station code to load its live NTES board.
                    </p>

                    {selectedStation &&
                        !loadingStation && (
                            <p className="mt-3 text-xs text-emerald-300/70">
                                Live board loaded for{" "}
                                {selectedStation}
                            </p>
                        )}

                </section>

                {/* =====================================================
                    SELECTED STATION
                ===================================================== */}

                {stationData && (
                    <section className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

                        <div className="flex items-start justify-between gap-3">

                            <div>

                                <p className="text-xs uppercase tracking-widest text-white/40">
                                    Selected station
                                </p>

                                <p className="mt-2 text-2xl font-semibold">
                                    {stationData.station_name ||
                                        selectedStation}
                                </p>

                                <p className="mt-1 text-sm text-white/45">
                                    {stationData.total_trains} live trains
                                </p>

                            </div>

                            <span
                                className={`rounded-full px-3 py-1 text-[10px] font-semibold ${dataSource ===
                                    "NTES_LIVE"
                                    ? "bg-emerald-400/10 text-emerald-300"
                                    : dataSource ===
                                        "REDIS_CACHE"
                                        ? "bg-amber-400/10 text-amber-300"
                                        : "bg-blue-400/10 text-blue-300"
                                    }`}
                            >
                                {dataSourceLabel}
                            </span>

                        </div>

                    </section>
                )}

                {/* =====================================================
                    LIVE STATION BOARD
                ===================================================== */}

                {stationData && (
                    <section className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

                        <div className="mb-4 flex items-center justify-between">

                            <div>

                                <p className="text-xs uppercase tracking-widest text-white/40">
                                    Live station board
                                </p>

                                <h2 className="mt-1 text-lg font-semibold">
                                    {stationData.station_name}
                                </h2>

                            </div>

                            <span className="text-xs text-white/40">
                                {stationData.total_trains} trains
                            </span>

                        </div>

                        <div className="space-y-3">

                            {stationData.trains?.map(
                                (
                                    train: StationTrain
                                ) => {

                                    const trainNumber =
                                        String(
                                            train.train_no
                                        ).trim();

                                    const isSelected =
                                        selectedTrain ===
                                        trainNumber;

                                    const arrivalDelay =
                                        Number(
                                            train.arrival_delay ||
                                            0
                                        );

                                    return (
                                        <button
                                            key={`${trainNumber}-${train.eta}-${train.etd}`}
                                            type="button"
                                            onClick={() =>
                                                handleTrainClick(
                                                    train
                                                )
                                            }
                                            className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition ${isSelected
                                                ? "border-blue-400/50 bg-blue-400/10"
                                                : "border-white/10 bg-[#0f0f18] hover:bg-white/[0.06]"
                                                }`}
                                        >

                                            <div className="flex items-start justify-between gap-3">

                                                <div className="min-w-0">

                                                    <p className="truncate font-semibold">
                                                        {trainNumber}
                                                        {" — "}
                                                        {train.train_name ||
                                                            "Unknown train"}
                                                    </p>

                                                    <p className="mt-1 truncate text-xs text-white/40">
                                                        {train.source_name ||
                                                            train.source ||
                                                            "—"}
                                                        {" → "}
                                                        {train.destination_name ||
                                                            train.destination ||
                                                            "—"}
                                                    </p>

                                                </div>

                                                <div className="shrink-0 text-right">

                                                    <p className="text-lg font-semibold">
                                                        {train.eta ||
                                                            train.etd ||
                                                            "—"}
                                                    </p>

                                                    <p className="text-xs text-white/40">
                                                        Platform{" "}
                                                        {train.platform ||
                                                            "—"}
                                                    </p>

                                                </div>

                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-2 text-xs">

                                                <span className="truncate text-white/40">
                                                    {train.train_type ||
                                                        "TRAIN"}
                                                </span>

                                                <span
                                                    className={
                                                        arrivalDelay >
                                                            15
                                                            ? "shrink-0 text-red-300"
                                                            : arrivalDelay >
                                                                0
                                                                ? "shrink-0 text-amber-300"
                                                                : "shrink-0 text-emerald-300"
                                                    }
                                                >
                                                    {arrivalDelay >
                                                        0
                                                        ? `${arrivalDelay} min late`
                                                        : "On time"}
                                                </span>

                                            </div>

                                        </button>
                                    );
                                }
                            )}

                        </div>

                    </section>
                )}

                {/* =====================================================
                    SELECTED TRAIN
                ===================================================== */}

                {selectedTrain && (
                    <section className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">

                        <div className="flex items-start justify-between">

                            <div>

                                <p className="text-xs uppercase tracking-widest text-blue-300">
                                    Selected train
                                </p>

                                <p className="mt-1 text-lg font-semibold">
                                    {selectedTrain}
                                </p>

                            </div>

                            {loadingTrain && (
                                <span className="text-xs text-blue-300">
                                    Updating...
                                </span>
                            )}

                        </div>

                        {selectedTrainError ? (

                            <p className="mt-3 text-sm text-red-400">
                                {selectedTrainError}
                            </p>

                        ) : loadingTrain ? (

                            <p className="mt-3 text-sm text-white/40">
                                Fetching live train status and RailDrishti prediction…
                            </p>

                        ) : selectedTrainStatus ? (

                            <div className="mt-3 space-y-3 text-sm text-white/60">

                                <p>
                                    Route:{" "}
                                    <span className="text-white">
                                        {
                                            selectedTrainStatus.SRCN ||
                                            selectedTrainStatus.SRC ||
                                            "—"
                                        }
                                        {" → "}
                                        {
                                            selectedTrainStatus.DSTNN ||
                                            "—"
                                        }
                                    </span>
                                </p>

                                {/* CURRENT STATION */}

                                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">

                                    <p className="text-[10px] uppercase tracking-widest text-blue-300">
                                        Current station
                                    </p>

                                    <p className="mt-1 text-xl font-semibold text-white">
                                        {currentStationName}
                                    </p>

                                    <p className="mt-1 text-xs text-blue-300/70">
                                        {current}
                                    </p>

                                </div>

                                <p>
                                    Delay:{" "}
                                    <span className="text-white">
                                        {Math.round(
                                            currentDelay
                                        )}{" "}
                                        min
                                    </span>
                                </p>

                                <p>
                                    Status:{" "}
                                    <span className="text-white">
                                        {
                                            selectedTrainStatus.CPOS ||
                                            "Running"
                                        }
                                    </span>
                                </p>

                                {selectedTrainRoute && (
                                    <p>
                                        Stations:{" "}
                                        <span className="text-white">
                                            {
                                                routeStations.length
                                            }
                                        </span>
                                    </p>
                                )}

                            </div>

                        ) : null}

                    </section>
                )}

                {/* =====================================================
                    ETA
                ===================================================== */}

                {firstPrediction && (
                    <ETACard
                        prediction={
                            firstPrediction
                        }
                    />
                )}

                {/* =====================================================
                    ROUTE MAP
                ===================================================== */}

                {displayStations.length > 0 && (
                    <TrainMap
                        stations={
                            displayStations
                        }
                        currentCode={
                            current
                        }
                    />
                )}

                {/* =====================================================
                    JOURNEY PROGRESS
                ===================================================== */}

                {selectedTrainRoute &&
                    routeStations.length > 0 && (
                        <section className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-xs uppercase tracking-widest text-white/40">
                                        Journey progress
                                    </p>

                                    <p className="mt-2 text-lg font-semibold text-white">
                                        {currentStationName}
                                    </p>

                                    <p className="mt-1 text-xs text-white/35">
                                        {current}
                                    </p>

                                </div>

                                <p className="text-2xl font-bold text-blue-400">
                                    {Math.round(
                                        journeyProgress
                                    )}
                                    %
                                </p>

                            </div>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">

                                <div
                                    className="h-full rounded-full bg-blue-400 transition-all duration-500"
                                    style={{
                                        width: `${journeyProgress}%`,
                                    }}
                                />

                            </div>

                            <div className="mt-2 flex justify-between text-xs text-white/40">

                                <span>
                                    {Math.round(
                                        currentDistance
                                    )}{" "}
                                    km approx. travelled
                                </span>

                                <span>
                                    {Math.round(
                                        totalDistance
                                    )}{" "}
                                    km total
                                </span>

                            </div>

                            {nextRouteStation && (
                                <div className="mt-4 rounded-2xl bg-[#0f0f18] p-3">

                                    <p className="text-[10px] uppercase tracking-widest text-white/30">
                                        Next scheduled station
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-white">
                                        {
                                            nextRouteStation.station_name
                                        }
                                    </p>

                                    <p className="text-xs text-white/40">
                                        {
                                            nextRouteStation.station_code
                                        }
                                    </p>

                                </div>
                            )}

                        </section>
                    )}

                {/* =====================================================
                    NEXT STATION
                ===================================================== */}

                {selectedTrainRoute &&
                    nextRouteStation && (
                        <section className="rounded-3xl border border-blue-400/20 bg-[#12121d] p-5">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                        Next station
                                    </p>

                                    <h2 className="mt-2 text-2xl font-semibold text-white">
                                        {
                                            nextRouteStation.station_name
                                        }
                                    </h2>

                                    <p className="mt-1 text-sm text-white/40">
                                        {
                                            nextRouteStation.station_code
                                        }
                                    </p>

                                </div>

                                <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
                                    LIVE
                                </span>

                            </div>

                            {(() => {

                                const nextPrediction =
                                    predictions.find(
                                        (
                                            prediction: ETAPrediction
                                        ) =>
                                            String(
                                                prediction?.station?.code ||
                                                ""
                                            )
                                                .trim()
                                                .toUpperCase() ===
                                            String(
                                                nextRouteStation?.station_code ||
                                                ""
                                            )
                                                .trim()
                                                .toUpperCase()
                                    );

                                if (
                                    !nextPrediction
                                ) {

                                    return (
                                        <div className="mt-5 rounded-2xl bg-[#0f0f18] p-4">

                                            <p className="text-sm text-white/40">
                                                RailDrishti prediction for the next station is currently unavailable.
                                            </p>

                                        </div>
                                    );
                                }

                                const nextDelay =
                                    Number(
                                        nextPrediction.delay_minutes ||
                                        0
                                    );

                                return (
                                    <div className="mt-5">

                                        <div className="rounded-2xl bg-[#0f0f18] p-4">

                                            <p className="text-xs uppercase tracking-widest text-white/30">
                                                Expected arrival
                                            </p>

                                            <div className="mt-2 flex items-end justify-between">

                                                <p className="text-3xl font-bold text-white">
                                                    {new Date(
                                                        nextPrediction.eta
                                                    ).toLocaleTimeString(
                                                        [],
                                                        {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        }
                                                    )}
                                                </p>

                                                <span
                                                    className={
                                                        nextDelay >
                                                            15
                                                            ? "rounded-full bg-red-400/10 px-3 py-1 text-xs text-red-300"
                                                            : nextDelay >
                                                                5
                                                                ? "rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-300"
                                                                : "rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300"
                                                    }
                                                >
                                                    {nextDelay >
                                                        0
                                                        ? `+${Math.round(
                                                            nextDelay
                                                        )} min`
                                                        : nextDelay <
                                                            0
                                                            ? `${Math.round(
                                                                nextDelay
                                                            )} min`
                                                            : "On time"}
                                                </span>

                                            </div>

                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-3">

                                            <div className="rounded-2xl bg-[#0f0f18] p-4">

                                                <p className="text-xs uppercase tracking-widest text-white/30">
                                                    Status
                                                </p>

                                                <p className="mt-2 text-sm font-semibold text-white">
                                                    {
                                                        nextPrediction.status ===
                                                            "late"
                                                            ? "Late"
                                                            : nextPrediction.status ===
                                                                "delayed"
                                                                ? "Delayed"
                                                                : nextPrediction.status ===
                                                                    "early"
                                                                    ? "Early"
                                                                    : "On time"
                                                    }
                                                </p>

                                            </div>

                                            <div className="rounded-2xl bg-[#0f0f18] p-4">

                                                <p className="text-xs uppercase tracking-widest text-white/30">
                                                    Prediction range
                                                </p>

                                                <p className="mt-2 text-sm font-semibold text-white">
                                                    {nextPrediction.confidence
                                                        ? `${nextPrediction.confidence.width_minutes} min`
                                                        : "—"}
                                                </p>

                                            </div>

                                        </div>

                                    </div>
                                );

                            })()}

                        </section>
                    )}

                {/* =====================================================
                    STATUS INTELLIGENCE
                ===================================================== */}

                {selectedTrainRoute &&
                    selectedTrainStatus && (
                        <section className="rounded-3xl border border-white/10 bg-[#12121d] p-5">

                            <div className="flex items-start justify-between gap-4">

                                <div>

                                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                        RailDrishti status intelligence
                                    </p>

                                    <h2 className="mt-2 text-xl font-semibold text-white">
                                        {
                                            statusIntelligence
                                        }
                                    </h2>

                                    <p className="mt-1 text-sm text-white/45">
                                        {currentDelay >
                                            0
                                            ? `${Math.round(
                                                currentDelay
                                            )} min behind schedule`
                                            : currentDelay <
                                                0
                                                ? `${Math.round(
                                                    Math.abs(
                                                        currentDelay
                                                    )
                                                )} min ahead of schedule`
                                                : "Operating on schedule"}
                                    </p>

                                </div>

                                <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs text-blue-300">
                                    AI
                                </span>

                            </div>

                            {/* CURRENT / NEXT / DESTINATION */}

                            <div className="mt-5 grid grid-cols-3 gap-2">

                                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-3">

                                    <p className="text-[10px] uppercase tracking-widest text-blue-300">
                                        Current
                                    </p>

                                    <p className="mt-2 truncate text-sm font-semibold text-white">
                                        {
                                            currentStationName
                                        }
                                    </p>

                                    <p className="mt-1 text-[10px] text-blue-300/60">
                                        {current}
                                    </p>

                                </div>

                                <div className="rounded-2xl bg-[#0f0f18] p-3">

                                    <p className="text-[10px] uppercase tracking-widest text-white/30">
                                        Next
                                    </p>

                                    <p className="mt-2 truncate text-sm font-semibold text-white">
                                        {
                                            nextRouteStation?.station_name ||
                                            "—"
                                        }
                                    </p>

                                    <p className="mt-1 text-[10px] text-white/30">
                                        {
                                            nextRouteStation?.station_code ||
                                            ""
                                        }
                                    </p>

                                </div>

                                <div className="rounded-2xl bg-[#0f0f18] p-3">

                                    <p className="text-[10px] uppercase tracking-widest text-white/30">
                                        Destination
                                    </p>

                                    <p className="mt-2 truncate text-sm font-semibold text-white">
                                        {
                                            destinationRouteStation?.station_name ||
                                            selectedTrainStatus?.DSTNN ||
                                            "—"
                                        }
                                    </p>

                                    <p className="mt-1 text-[10px] text-white/30">
                                        {
                                            destinationRouteStation?.station_code ||
                                            ""
                                        }
                                    </p>

                                </div>

                            </div>

                            {/* DELAY OUTLOOK */}

                            <div className="mt-4 rounded-2xl border border-white/5 bg-[#0f0f18] p-4">

                                <p className="text-xs uppercase tracking-widest text-white/30">
                                    Delay outlook
                                </p>

                                <p className="mt-2 text-sm leading-6 text-white/70">
                                    {
                                        statusExplanation
                                    }
                                </p>

                                {predictions.length >
                                    0 && (
                                        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">

                                            <span className="text-xs text-white/35">
                                                Projected delay range
                                            </span>

                                            <span className="text-sm font-semibold text-blue-300">
                                                {
                                                    predictionRangeText
                                                }
                                            </span>

                                        </div>
                                    )}

                            </div>

                        </section>
                    )}

                {/* =====================================================
                    ML REASONING
                ===================================================== */}

                {payload && (
                    <section className="rounded-3xl border border-blue-400/20 bg-[#12121d] p-5">

                        <div className="flex items-start justify-between gap-4">

                            <div>

                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                    Why this prediction?
                                </p>

                                <h2 className="mt-2 text-xl font-semibold text-white">
                                    RailDrishti ML reasoning
                                </h2>

                            </div>

                            <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs text-blue-300">
                                AI
                            </span>

                        </div>

                        <div className="mt-4 rounded-2xl bg-[#0f0f18] p-4">

                            <p className="text-sm leading-6 text-white/70">
                                {mlExplanation}
                            </p>

                        </div>

                        <div className="mt-4">

                            <p className="text-xs uppercase tracking-widest text-white/30">
                                Prediction factors
                            </p>

                            <div className="mt-3 space-y-2">

                                {mlFactors.map(
                                    (
                                        factor,
                                        index
                                    ) => (
                                        <div
                                            key={
                                                index
                                            }
                                            className="flex items-center gap-3 rounded-xl bg-[#0f0f18] px-3 py-3"
                                        >

                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-400/10 text-[10px] text-blue-300">
                                                {
                                                    index +
                                                    1
                                                }
                                            </span>

                                            <span className="text-xs text-white/60">
                                                {
                                                    factor
                                                }
                                            </span>

                                        </div>
                                    )
                                )}

                            </div>

                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">

                            <span className="text-xs text-white/35">
                                Ensemble confidence
                            </span>

                            <span className="text-sm font-semibold text-blue-300">
                                {Math.round(
                                    payload.model_confidence
                                )}
                                %
                            </span>

                        </div>

                    </section>
                )}

                {/* =====================================================
                    ML INSIGHT
                ===================================================== */}

                {payload && (
                    <MLInsightCard
                        text={
                            payload.insight ||
                            "Dynamic ensemble is updating ETA from live operating conditions."
                        }
                        confidence={
                            payload.model_confidence
                        }
                    />
                )}

                {/* =====================================================
                    STATIONS AHEAD
                ===================================================== */}

                {payload &&
                    displayStations.length >
                    0 && (
                        <section className="rounded-3xl border border-white/10 bg-[#0f0f18] p-5">

                            <div className="mb-5 flex justify-between">

                                <h2 className="font-semibold">
                                    Stations ahead
                                </h2>

                                <span className="text-xs text-white/40">
                                    RailDrishri prediction
                                </span>

                            </div>

                            <StationTimeline
                                stations={
                                    displayStations
                                }
                                predictions={
                                    predictions
                                }
                                currentCode={
                                    current
                                }
                                trainStarted={
                                    selectedTrainRoute?.yet_to_start === true
                                        ? false
                                        : true
                                }
                            />

                        </section>
                    )}

            </div>

        </main>
    );
}