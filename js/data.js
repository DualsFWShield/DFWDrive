/**
 * DFWDrive Data Model & Default Constants
 * Clean baseline: metric by default (km, km/h, m), empty drives.
 */

export const DEFAULT_USER_PROFILE = {
  name: "Conducteur",
  tag: "@pilote",
  avatar: "🏎️",
  units: "kmh", // Default: metric (km, km/h, m)
  bio: "Enregistrement automatique de chaque kilomètre."
};

export const INITIAL_VEHICLES = [
  {
    id: "veh_1",
    type: "car",
    model3d: "porsche",
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

export const VEHICLE_3D_CATALOG = [
  // Supercars & GT (Pack Ultime Low-Poly 2)
  {
    id: "porsche",
    name: "Porsche 911 GT3 RS",
    category: "Supercars & GT",
    pack: "pack2",
    nodeName: "Porsche",
    emoji: "🏎️",
    type: "car",
    make: "Porsche",
    model: "911 GT3 RS",
    description: "Flat-6 atmosphérique mythique, appui aéro extrême et son légendaire",
    packLabel: "Pack Ultime 2"
  },
  {
    id: "p1gtr",
    name: "McLaren P1 GTR",
    category: "Supercars & GT",
    pack: "pack2",
    nodeName: "P1GTR",
    emoji: "🚀",
    type: "car",
    make: "McLaren",
    model: "P1 GTR",
    description: "Hypercar hybride biturbo de 1000 ch conçue pour la vitesse absolue",
    packLabel: "Pack Ultime 2"
  },
  {
    id: "gtr",
    name: "Nissan GT-R Nismo",
    category: "Supercars & GT",
    pack: "pack2",
    nodeName: "GTR",
    emoji: "⚡",
    type: "car",
    make: "Nissan",
    model: "GT-R R35 Nismo",
    description: "Transmission intégrale chirurgicale et accélération foudroyante",
    packLabel: "Pack Ultime 2"
  },
  {
    id: "m8",
    name: "BMW M8 Competition",
    category: "Supercars & GT",
    pack: "pack2",
    nodeName: "M8",
    emoji: "🏎️",
    type: "car",
    make: "BMW",
    model: "M8 Competition",
    description: "V8 4.4L biturbo bavarois alliant luxe suprême et sportivité brute",
    packLabel: "Pack Ultime 2"
  },
  {
    id: "mercedes",
    name: "Mercedes-AMG GT",
    category: "Supercars & GT",
    pack: "pack2",
    nodeName: "Mercedes",
    emoji: "🏎️",
    type: "car",
    make: "Mercedes-AMG",
    model: "AMG GT Coupé",
    description: "Capot allongé, V8 biturbo rugissant et équilibre parfait",
    packLabel: "Pack Ultime 2"
  },
  {
    id: "mustang",
    name: "Ford Mustang GT V8",
    category: "Supercars & GT",
    pack: "pack2",
    nodeName: "Mustang",
    emoji: "🏎️",
    type: "car",
    make: "Ford",
    model: "Mustang GT",
    description: "Légende américaine au tempérament musclé et son inimitable",
    packLabel: "Pack Ultime 2"
  },
  {
    id: "urus",
    name: "Lamborghini Urus",
    category: "Supercars & GT",
    pack: "pack2",
    nodeName: "Urus",
    emoji: "🚙",
    type: "car",
    make: "Lamborghini",
    model: "Urus Super SUV",
    description: "Le premier Super SUV combinant puissance de supercar et polyvalence",
    packLabel: "Pack Ultime 2"
  },

  // Voitures & Séries (Pack Low-Poly 1)
  {
    id: "roadster",
    name: "Roadster Sport Spyder",
    category: "Voitures & Séries",
    pack: "pack1",
    nodeName: "Roadster",
    emoji: "🏎️",
    type: "car",
    make: "Mazda",
    model: "MX-5 Spyder",
    description: "Cabriolet biplace ultra-léger et agile pour le plaisir pur de la route",
    packLabel: "Pack Poly 1"
  },
  {
    id: "sports",
    name: "Supercar Sport GT",
    category: "Voitures & Séries",
    pack: "pack1",
    nodeName: "Sports",
    emoji: "🏎️",
    type: "car",
    make: "Ferrari",
    model: "Sport GT",
    description: "Silhouette italienne profilée avec aileron arrière dynamique",
    packLabel: "Pack Poly 1"
  },
  {
    id: "muscle",
    name: "Muscle Car V8 1969",
    category: "Voitures & Séries",
    pack: "pack1",
    nodeName: "Muscle",
    emoji: "🏎️",
    type: "car",
    make: "Dodge",
    model: "Charger R/T 1969",
    description: "Lignes musclées rétro et puissance à l'état pur sur l'asphalte",
    packLabel: "Pack Poly 1"
  },
  {
    id: "sedan",
    name: "Berline Sport V6",
    category: "Voitures & Séries",
    pack: "pack1",
    nodeName: "Sedan",
    emoji: "🚗",
    type: "car",
    make: "Audi",
    model: "RS4 Berline",
    description: "Élégance discrète et polyvalence quotidienne sur autoroute",
    packLabel: "Pack Poly 1"
  },
  {
    id: "hatchback",
    name: "Compacte Sportive Hot-Hatch",
    category: "Voitures & Séries",
    pack: "pack1",
    nodeName: "Hatchback",
    emoji: "🚗",
    type: "car",
    make: "Volkswagen",
    model: "Golf R",
    description: "Précision diabolique et réactivité immédiate en ville et lacets",
    packLabel: "Pack Poly 1"
  },
  {
    id: "suv",
    name: "SUV Baroudeur 4x4",
    category: "Voitures & Séries",
    pack: "pack1",
    nodeName: "SUV",
    emoji: "🚙",
    type: "car",
    make: "Toyota",
    model: "Land Cruiser 4x4",
    description: "Garde au sol élevée prête pour affronter tous les revêtements",
    packLabel: "Pack Poly 1"
  },
  {
    id: "pickup",
    name: "Pickup Off-Road 4x4",
    category: "Voitures & Séries",
    pack: "pack1",
    nodeName: "Pickup",
    emoji: "🛻",
    type: "car",
    make: "Ford",
    model: "F-150 Raptor",
    description: "Châssis robuste et benne spacieuse conçue pour l'aventure",
    packLabel: "Pack Poly 1"
  },

  // Véhicules Spéciaux (Pack Low-Poly 1)
  {
    id: "taxi",
    name: "Cyber Taxi Ville",
    category: "Véhicules Spéciaux",
    pack: "pack1",
    nodeName: "Taxi",
    emoji: "🚕",
    type: "car",
    make: "Crown",
    model: "Cyber Taxi",
    description: "L'incontournable taxi jaune urbain pour vos trajets nocturnes",
    packLabel: "Pack Poly 1"
  },
  {
    id: "police",
    name: "Police Interceptor",
    category: "Véhicules Spéciaux",
    pack: "pack1",
    nodeName: "Police Sports",
    emoji: "🚔",
    type: "car",
    make: "Interceptor",
    model: "Police Pursuit",
    description: "Rampe de gyrophares LED et carrosserie sport haute interception",
    packLabel: "Pack Poly 1"
  },
  {
    id: "monstertruck",
    name: "Monster Truck Extrême",
    category: "Véhicules Spéciaux",
    pack: "pack1",
    nodeName: "Monster Truck",
    emoji: "🚜",
    type: "car",
    make: "BigFoot",
    model: "Monster V8",
    description: "Pneus gigantesques et suspensions démesurées sans concession",
    packLabel: "Pack Poly 1"
  },

  // Deux-Roues (Modèles 3D Stylisés)
  {
    id: "bike",
    name: "Vélo de Route / Gravel 3D",
    category: "Deux-Roues",
    pack: "procedural",
    nodeName: "bike",
    emoji: "🚴",
    type: "bike",
    make: "Specialized",
    model: "S-Works Tarmac SL8",
    description: "Cadre carbone aérodynamique, roues à profil haut et cintre de course",
    packLabel: "3D Natif"
  },
  {
    id: "motorcycle",
    name: "Moto Superbike / Roadster 3D",
    category: "Deux-Roues",
    pack: "procedural",
    nodeName: "motorcycle",
    emoji: "🏍️",
    type: "motorcycle",
    make: "Ducati",
    model: "Panigale V4",
    description: "Réservoir sculpté, double échappement et signature lumineuse affûtée",
    packLabel: "3D Natif"
  }
];

// Clean state: NO mock drives by default
export const INITIAL_DRIVES = [];

export const MILESTONE_TARGETS = {
  indy500: {
    label: "Tours de Circuit",
    distanceKm: 4.0,
    icon: "🏁",
    colorClass: "indy"
  },
  coastToCoast: {
    label: "Traversée Continentale",
    distanceKm: 1000.0,
    icon: "🗺️",
    colorClass: "coast"
  },
  aroundEarth: {
    label: "Tour de la Terre",
    distanceKm: 40075.0,
    icon: "🌍",
    colorClass: "earth"
  },
  toTheMoon: {
    label: "Vers la Lune",
    distanceKm: 384400.0,
    icon: "🌕",
    colorClass: "moon"
  },
  tourDeFrance: {
    label: "Étape Mythique",
    distanceKm: 180.0,
    icon: "🚴",
    colorClass: "tour"
  }
};

// Community Benchmarks in km (Safe smoothness & consistency)
export const LEADERBOARD_USERS = [
  {
    rank: 1,
    name: "Alexandre M.",
    avatar: "🏎️",
    vehicle: "Porsche 911 GT3",
    category: "car",
    totalDistance: 145.0,
    safeScore: 99,
    activeDays: 14
  },
  {
    rank: 2,
    name: "Clara R.",
    avatar: "🚴",
    vehicle: "Specialized Tarmac",
    category: "bike",
    totalDistance: 92.5,
    safeScore: 100,
    activeDays: 18
  },
  {
    rank: 3,
    name: "Thomas D.",
    avatar: "🏍️",
    vehicle: "BMW S1000RR",
    category: "motorcycle",
    totalDistance: 64.0,
    safeScore: 96,
    activeDays: 9
  }
];
