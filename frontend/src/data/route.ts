import type { Station } from "../types";

export const stations: Station[] = [
  {
    code: "NHT",
    name: "Nalhati Junction",
    distance_km: 45,
    scheduled_arrival: "08:45",
    scheduled_departure: "08:47",
    platform: 1,
  },
  {
    code: "RPH",
    name: "Rampur Hat",
    distance_km: 59,
    scheduled_arrival: "09:10",
    scheduled_departure: "09:12",
    platform: 3,
  },
  {
    code: "SNT",
    name: "Sainthia Junction",
    distance_km: 87,
    scheduled_arrival: "09:34",
    scheduled_departure: "09:35",
    platform: 4,
  },
  {
    code: "AMP",
    name: "Ahmadpur Junction",
    distance_km: 101,
    scheduled_arrival: "09:47",
    scheduled_departure: "09:48",
    platform: 2,
  },
  {
    code: "BHP",
    name: "Bolpur Shantiniketan",
    distance_km: 120,
    scheduled_arrival: "10:05",
    scheduled_departure: "10:07",
    platform: 2,
  },
  {
    code: "BWN",
    name: "Barddhaman Junction",
    distance_km: 171,
    scheduled_arrival: "11:27",
    scheduled_departure: "11:29",
    platform: 5,
  },
  {
    code: "BDC",
    name: "Bandel Junction",
    distance_km: 239,
    scheduled_arrival: "12:40",
    scheduled_departure: "12:42",
    platform: 3,
  },
  {
    code: "HWH",
    name: "Howrah Junction",
    distance_km: 278,
    scheduled_arrival: "13:55",
    scheduled_departure: "13:55",
    platform: 1,
  },
];

export const routeCodes = stations.map((station) => station.code);