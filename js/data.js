/**
 * DFWDrive Data Model & Default Constants
 * Clean baseline: empty drives by default so user records their actual trips.
 */

export const DEFAULT_USER_PROFILE = {
  name: "Driver",
  tag: "@dfwdriver",
  avatar: "🏎️",
  units: "mph", // 'mph' or 'kmh'
  bio: "Capturing every mile automatically."
};

export const INITIAL_VEHICLES = [
  {
    id: "veh_1",
    type: "car",
    make: "Porsche",
    model: "911 GT3 RS",
    year: 2024,
    color: "#ff3b30",
    emoji: "🏎️",
    odometer: 0,
    isPrimary: true,
    totalDrives: 0,
    totalDistance: 0
  }
];

// Clean state: NO mock drives by default
export const INITIAL_DRIVES = [];

export const MILESTONE_TARGETS = {
  indy500: {
    label: "Indy 500 Laps",
    distanceMiles: 2.5,
    icon: "🏁",
    colorClass: "indy"
  },
  coastToCoast: {
    label: "Coast to Coast",
    distanceMiles: 2790,
    icon: "🇺🇸",
    colorClass: "coast"
  },
  aroundEarth: {
    label: "Around Earth",
    distanceMiles: 24901,
    icon: "🌍",
    colorClass: "earth"
  },
  toTheMoon: {
    label: "To the Moon",
    distanceMiles: 238855,
    icon: "🌕",
    colorClass: "moon"
  },
  tourDeFrance: {
    label: "Tour de France Route",
    distanceMiles: 2115,
    icon: "🚴",
    colorClass: "tour"
  }
};

// Safe Community Leaderboard (Safe smoothness & consistency)
export const LEADERBOARD_USERS = [
  {
    rank: 1,
    name: "Marcus Vance",
    avatar: "🏎️",
    vehicle: "Porsche 911 GT3",
    category: "car",
    totalDistance: 2450.0,
    safeScore: 99,
    activeDays: 28
  },
  {
    rank: 2,
    name: "Elena Rostova",
    avatar: "🚴",
    vehicle: "Specialized Tarmac",
    category: "bike",
    totalDistance: 1820.5,
    safeScore: 100,
    activeDays: 31
  },
  {
    rank: 3,
    name: "Devon Chen",
    avatar: "🏍️",
    vehicle: "BMW S1000RR",
    category: "motorcycle",
    totalDistance: 1410.2,
    safeScore: 96,
    activeDays: 22
  }
];
