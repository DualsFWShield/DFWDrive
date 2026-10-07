/**
 * DFWDrive Statistics & Milestones Computation Engine
 */

import { MILESTONE_TARGETS } from './data.js';

export class StatsEngine {
  static compute(drives = [], timeFilter = 'all') {
    // Filter drives by selected time period if specified
    const filteredDrives = this.filterDrivesByTime(drives, timeFilter);

    if (filteredDrives.length === 0) {
      return {
        totalDistance: 0,
        avgDistance: 0,
        totalDrives: 0,
        topSpeed: 0,
        longestDrive: null,
        milestones: this.computeMilestones(0),
        speedDistribution: { under30: 0, range30to50: 0, range50to70: 0, range70to100: 0, over100: 0 },
        ecoCarbonSavedKg: 0
      };
    }

    const totalDistance = filteredDrives.reduce((sum, d) => sum + (d.distance || 0), 0);
    const avgDistance = totalDistance / filteredDrives.length;
    const topSpeed = Math.max(...filteredDrives.map(d => d.topSpeed || 0));

    // Longest drive
    const longestDrive = [...filteredDrives].sort((a, b) => (b.distance || 0) - (a.distance || 0))[0];

    // Compute Milestones
    const milestones = this.computeMilestones(totalDistance);

    // Compute cumulative speed distribution
    const speedDistribution = this.computeCumulativeDistribution(filteredDrives);

    // Carbon savings for bike & ebike drives (~0.404 kg CO2 per mile compared to avg car)
    const bikeDistance = filteredDrives
      .filter(d => d.vehicleType === 'bike' || d.vehicleType === 'ebike')
      .reduce((sum, d) => sum + (d.distance || 0), 0);
    const ecoCarbonSavedKg = Math.round(bikeDistance * 0.404);

    return {
      totalDistance: Math.round(totalDistance),
      totalDistanceExact: Number(totalDistance.toFixed(1)),
      avgDistance: Number(avgDistance.toFixed(1)),
      totalDrives: filteredDrives.length,
      topSpeed,
      longestDrive,
      milestones,
      speedDistribution,
      ecoCarbonSavedKg
    };
  }

  static filterDrivesByTime(drives, filter) {
    if (filter === 'all') return drives;

    const monthMap = {
      'jun': 5, // 0-indexed month
      'may': 4,
      'apr': 3,
      'mar': 2
    };

    const targetMonth = monthMap[filter.toLowerCase()];
    if (targetMonth === undefined) return drives;

    return drives.filter(d => {
      const date = new Date(d.timestamp);
      return date.getMonth() === targetMonth;
    });
  }

  static computeMilestones(totalDistance) {
    const formatMultiplier = (val) => {
      if (val >= 10) return `${Math.round(val).toLocaleString()}x`;
      if (val >= 1) return `${val.toFixed(2)}x`;
      return `${val.toFixed(2)}x`;
    };

    const indyMult = totalDistance / MILESTONE_TARGETS.indy500.distanceMiles;
    const coastMult = totalDistance / MILESTONE_TARGETS.coastToCoast.distanceMiles;
    const earthMult = totalDistance / MILESTONE_TARGETS.aroundEarth.distanceMiles;
    const moonMult = totalDistance / MILESTONE_TARGETS.toTheMoon.distanceMiles;
    const tourMult = totalDistance / MILESTONE_TARGETS.tourDeFrance.distanceMiles;

    return [
      {
        id: 'indy500',
        label: MILESTONE_TARGETS.indy500.label,
        icon: MILESTONE_TARGETS.indy500.icon,
        colorClass: MILESTONE_TARGETS.indy500.colorClass,
        multiplierText: formatMultiplier(indyMult),
        isCompleted: indyMult >= 1,
        progressPercent: 100
      },
      {
        id: 'coastToCoast',
        label: MILESTONE_TARGETS.coastToCoast.label,
        icon: MILESTONE_TARGETS.coastToCoast.icon,
        colorClass: MILESTONE_TARGETS.coastToCoast.colorClass,
        multiplierText: formatMultiplier(coastMult),
        isCompleted: coastMult >= 1,
        progressPercent: Math.min(100, Math.round(coastMult * 100))
      },
      {
        id: 'aroundEarth',
        label: MILESTONE_TARGETS.aroundEarth.label,
        icon: MILESTONE_TARGETS.aroundEarth.icon,
        colorClass: MILESTONE_TARGETS.aroundEarth.colorClass,
        multiplierText: formatMultiplier(earthMult),
        isCompleted: earthMult >= 1,
        progressPercent: Math.min(100, Math.max(12, Math.round(earthMult * 100)))
      },
      {
        id: 'toTheMoon',
        label: MILESTONE_TARGETS.toTheMoon.label,
        icon: MILESTONE_TARGETS.toTheMoon.icon,
        colorClass: MILESTONE_TARGETS.toTheMoon.colorClass,
        multiplierText: formatMultiplier(moonMult),
        isCompleted: moonMult >= 1,
        progressPercent: Math.min(100, Math.max(8, Math.round(moonMult * 100)))
      },
      {
        id: 'tourDeFrance',
        label: MILESTONE_TARGETS.tourDeFrance.label,
        icon: MILESTONE_TARGETS.tourDeFrance.icon,
        colorClass: MILESTONE_TARGETS.tourDeFrance.colorClass,
        multiplierText: formatMultiplier(tourMult),
        isCompleted: tourMult >= 1,
        progressPercent: Math.min(100, Math.round(tourMult * 100))
      }
    ];
  }

  static computeCumulativeDistribution(drives) {
    let totalU30 = 0, total30_50 = 0, total50_70 = 0, total70_100 = 0, total100 = 0;
    let count = 0;

    drives.forEach(d => {
      if (d.speedDistribution) {
        totalU30 += d.speedDistribution.under30 || 0;
        total30_50 += d.speedDistribution.range30to50 || 0;
        total50_70 += d.speedDistribution.range50to70 || 0;
        total70_100 += d.speedDistribution.range70to100 || 0;
        total100 += d.speedDistribution.over100 || 0;
        count++;
      }
    });

    if (count === 0) {
      return { under30: 20, range30to50: 20, range50to70: 45, range70to100: 15, over100: 0 };
    }

    return {
      under30: Math.round(totalU30 / count),
      range30to50: Math.round(total30_50 / count),
      range50to70: Math.round(total50_70 / count),
      range70to100: Math.round(total70_100 / count),
      over100: Math.round(total100 / count)
    };
  }
}
