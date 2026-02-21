// ============================================================
// Hospital Registry — tracks hospitals with locations, specialties,
// and availability. Used by the corridor engine to route ambulances
// from the accident scene to the nearest suitable hospital.
// ============================================================
import type { GeoPoint } from '../../../../shared/models/rctf';

// ── Hospital Record ───────────────────────────────────────────
export interface HospitalRecord {
    hospitalId: string;
    name: string;
    location: GeoPoint;
    phone: string;
    specialties: string[];  // e.g. 'TRAUMA', 'BURN', 'CARDIAC', 'GENERAL'
    bedsAvailable: number;
    emergencyCapable: boolean;
    active: boolean;        // Whether hospital is accepting patients
}

// ── Haversine distance (km) ───────────────────────────────────
function haversineKm(a: GeoPoint, b: GeoPoint): number {
    const R = 6371;
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── In-memory registry (seeded with Pune hospitals for demo) ──
const hospitalRegistry = new Map<string, HospitalRecord>();

// Seed hospitals around Pune, India (demo area — same region as signals)
if (process.env.NODE_ENV !== 'production' || process.env.SEED_HOSPITALS === 'true') {
    const demoHospitals: HospitalRecord[] = [
        {
            hospitalId: 'HOSP-RUBY',
            name: 'Ruby Hall Clinic',
            location: { lat: 18.5308, lng: 73.8774 },
            phone: '+912026163391',
            specialties: ['TRAUMA', 'CARDIAC', 'GENERAL'],
            bedsAvailable: 12,
            emergencyCapable: true,
            active: true,
        },
        {
            hospitalId: 'HOSP-KEM',
            name: 'KEM Hospital Pune',
            location: { lat: 18.5018, lng: 73.8636 },
            phone: '+912026126000',
            specialties: ['TRAUMA', 'BURN', 'GENERAL'],
            bedsAvailable: 8,
            emergencyCapable: true,
            active: true,
        },
        {
            hospitalId: 'HOSP-SAHYADRI',
            name: 'Sahyadri Hospital Deccan',
            location: { lat: 18.5128, lng: 73.8412 },
            phone: '+912067215000',
            specialties: ['TRAUMA', 'CARDIAC', 'NEURO', 'GENERAL'],
            bedsAvailable: 15,
            emergencyCapable: true,
            active: true,
        },
        {
            hospitalId: 'HOSP-JEHANGIR',
            name: 'Jehangir Hospital',
            location: { lat: 18.5310, lng: 73.8760 },
            phone: '+912026053600',
            specialties: ['TRAUMA', 'CARDIAC', 'GENERAL'],
            bedsAvailable: 10,
            emergencyCapable: true,
            active: true,
        },
        {
            hospitalId: 'HOSP-SASSOON',
            name: 'Sassoon General Hospital',
            location: { lat: 18.5165, lng: 73.8721 },
            phone: '+912026128000',
            specialties: ['TRAUMA', 'BURN', 'GENERAL'],
            bedsAvailable: 20,
            emergencyCapable: true,
            active: true,
        },
        {
            hospitalId: 'HOSP-ADITYA-BIRLA',
            name: 'Aditya Birla Memorial Hospital',
            location: { lat: 18.6298, lng: 73.7997 },
            phone: '+912030717171',
            specialties: ['TRAUMA', 'CARDIAC', 'NEURO', 'GENERAL'],
            bedsAvailable: 18,
            emergencyCapable: true,
            active: true,
        },
    ];

    for (const h of demoHospitals) {
        hospitalRegistry.set(h.hospitalId, h);
    }
    console.log(`[corridor-service] Seeded ${demoHospitals.length} demo hospitals`);
}

// ── Find nearest hospital ─────────────────────────────────────
export function findNearestHospital(
    location: GeoPoint,
    options?: {
        specialty?: string;       // Filter by specialty (e.g. 'TRAUMA')
        minBeds?: number;         // Minimum available beds
        limit?: number;           // How many to return (default: 1)
    }
): (HospitalRecord & { distanceKm: number })[] {
    if (isNaN(location.lat) || isNaN(location.lng)) return [];

    const limit = options?.limit ?? 1;
    const minBeds = options?.minBeds ?? 1;

    return Array.from(hospitalRegistry.values())
        .filter((h) => {
            if (!h.active || !h.emergencyCapable) return false;
            if (h.bedsAvailable < minBeds) return false;
            if (options?.specialty && !h.specialties.includes(options.specialty)) return false;
            return true;
        })
        .map((h) => ({
            ...h,
            distanceKm: haversineKm(location, h.location),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, limit);
}

// ── CRUD helpers ──────────────────────────────────────────────
export function getHospital(hospitalId: string): HospitalRecord | undefined {
    return hospitalRegistry.get(hospitalId);
}

export function getAllHospitals(): HospitalRecord[] {
    return Array.from(hospitalRegistry.values());
}

export function registerHospital(hospital: HospitalRecord): void {
    hospitalRegistry.set(hospital.hospitalId, hospital);
}

export function updateHospitalBeds(hospitalId: string, bedsAvailable: number): void {
    const h = hospitalRegistry.get(hospitalId);
    if (h) h.bedsAvailable = bedsAvailable;
}

export function setHospitalActive(hospitalId: string, active: boolean): void {
    const h = hospitalRegistry.get(hospitalId);
    if (h) h.active = active;
}
