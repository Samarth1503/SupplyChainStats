// Shapes of the JSON data returned by the Express API.

export type ShipmentMode = 'Plane' | 'Ferry';
export type ShipmentStatus = 'Arrived' | 'In transit' | 'Scheduled';

export interface Destination {
  country: string;
  city: string;
  code: string;
}

export interface Shipment {
  id: string;
  mode: ShipmentMode;
  destinationCountry: string;
  departureDate: string;
  arrivalDate: string;
  status: ShipmentStatus;
  weightKg: number;
  costUsd: number;
}

export interface Tariff {
  destinationCountry: string;
  planePerKg: number;
  ferryPerKg: number | null;
}

export interface CustomerLevel {
  levelName: string;
  validUntil: string;
  friendPaymentPercent: number;
  redemptionPercent: number;
  kgBought: number;
  kgRequiredForRenewal: number;
  renewalDeadline: string;
}

export interface ModeStats {
  shipments: number;
  weightKg: number;
  avgTransitDays: number;
}

export interface Stats {
  totalShipments: number;
  totalWeightKg: number;
  totalRevenueUsd: number;
  byStatus: Record<ShipmentStatus, number>;
  byMode: Record<ShipmentMode, ModeStats>;
  byDestination: { destinationCountry: string; shipments: number; weightKg: number }[];
  monthly: { month: string; shipments: number }[];
}
