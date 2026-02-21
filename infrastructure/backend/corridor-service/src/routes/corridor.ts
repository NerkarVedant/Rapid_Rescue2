import { Router, Request, Response } from 'express';
import { corridorEngine } from '../services/corridorEngine';
import {
    findNearestHospital,
    getAllHospitals,
    getHospital,
    updateHospitalBeds,
} from '../services/hospitalRegistry';
import { v4 as uuidv4 } from 'uuid';

export const corridorRouter = Router();

// POST /api/corridor/init — called by detection-service when SOS is received
corridorRouter.post('/init', (req: Request, res: Response) => {
    const { payload } = req.body;
    if (!payload?.accidentId || !payload?.location) {
        res.status(400).json({ error: 'Missing accidentId or location' });
        return;
    }

    // Store the accident scene location so the corridor engine can
    // detect when the ambulance arrives at the scene
    corridorEngine.setSceneLocation(payload.accidentId, payload.location);

    console.log(`[corridor-service] Corridor initialized for ${payload.accidentId}`);
    res.json({ payload: { accidentId: payload.accidentId, status: 'CORRIDOR_INITIALIZED' } });
});

// POST /api/corridor/location — ambulance location update
corridorRouter.post('/location', (req: Request, res: Response) => {
    corridorEngine.processAmbulanceUpdate(req.body);
    res.json({ payload: { status: 'PROCESSED' } });
});

// GET /api/corridor/signals — get all signal states
corridorRouter.get('/signals', (_req: Request, res: Response) => {
    const signals = corridorEngine.getAllSignals();
    res.json({
        meta: { requestId: `REQ-${uuidv4()}`, timestamp: new Date().toISOString(), env: process.env.NODE_ENV ?? 'development', version: '1.0' },
        payload: { signals, total: signals.length },
    });
});

// GET /api/corridor/signals/:id — get specific signal
corridorRouter.get('/signals/:id', (req: Request, res: Response) => {
    const signal = corridorEngine.getSignal(req.params.id);
    if (!signal) {
        res.status(404).json({ error: 'Signal not found' });
        return;
    }
    res.json({ payload: signal });
});

// GET /api/corridor/active — get active corridors
corridorRouter.get('/active', (_req: Request, res: Response) => {
    res.json({ payload: corridorEngine.getActiveCorridors() });
});

// ── Hospital Routes ───────────────────────────────────────────

// GET /api/corridor/hospitals — list all hospitals
corridorRouter.get('/hospitals', (_req: Request, res: Response) => {
    const hospitals = getAllHospitals();
    res.json({
        meta: { requestId: `REQ-${uuidv4()}`, timestamp: new Date().toISOString(), env: process.env.NODE_ENV ?? 'development', version: '1.0' },
        payload: { hospitals, total: hospitals.length },
    });
});

// GET /api/corridor/hospitals/nearest — find nearest hospital to given coordinates
corridorRouter.get('/hospitals/nearest', (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const limit = parseInt(req.query.limit as string) || 3;
    const specialty = req.query.specialty as string | undefined;

    if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ error: 'lat and lng query parameters required (numbers)' });
        return;
    }

    const hospitals = findNearestHospital({ lat, lng }, { specialty, limit });
    res.json({
        payload: {
            hospitals: hospitals.map((h) => ({
                ...h,
                mapLink: `https://www.google.com/maps?q=${h.location.lat},${h.location.lng}`,
            })),
            total: hospitals.length,
        },
    });
});

// GET /api/corridor/hospitals/:id — get specific hospital
corridorRouter.get('/hospitals/:id', (req: Request, res: Response) => {
    const hospital = getHospital(req.params.id);
    if (!hospital) {
        res.status(404).json({ error: 'Hospital not found' });
        return;
    }
    res.json({
        payload: {
            ...hospital,
            mapLink: `https://www.google.com/maps?q=${hospital.location.lat},${hospital.location.lng}`,
        },
    });
});

// PATCH /api/corridor/hospitals/:id/beds — update available beds
corridorRouter.patch('/hospitals/:id/beds', (req: Request, res: Response) => {
    const { bedsAvailable } = req.body;
    if (typeof bedsAvailable !== 'number' || bedsAvailable < 0) {
        res.status(400).json({ error: 'bedsAvailable (non-negative number) required' });
        return;
    }
    const hospital = getHospital(req.params.id);
    if (!hospital) {
        res.status(404).json({ error: 'Hospital not found' });
        return;
    }
    updateHospitalBeds(req.params.id, bedsAvailable);
    res.json({ payload: { hospitalId: req.params.id, bedsAvailable } });
});

// ── Mission Routes ────────────────────────────────────────────

// GET /api/corridor/missions — list all active ambulance missions
corridorRouter.get('/missions', (_req: Request, res: Response) => {
    const missions = corridorEngine.getAllMissions();
    res.json({
        payload: {
            missions: missions.map((m) => ({
                accidentId: m.accidentId,
                entityId: m.entityId,
                phase: m.phase,
                sceneLocation: m.sceneLocation,
                hospital: m.hospital ? {
                    hospitalId: m.hospital.hospitalId,
                    name: m.hospital.name,
                    location: m.hospital.location,
                    phone: m.hospital.phone,
                    mapLink: `https://www.google.com/maps?q=${m.hospital.location.lat},${m.hospital.location.lng}`,
                } : null,
                arrivedAtSceneAt: m.arrivedAtSceneAt,
                arrivedAtHospitalAt: m.arrivedAtHospitalAt,
            })),
            total: missions.length,
        },
    });
});

// GET /api/corridor/missions/:accidentId — get mission for a specific accident
corridorRouter.get('/missions/:accidentId', (req: Request, res: Response) => {
    const mission = corridorEngine.getMission(req.params.accidentId);
    if (!mission) {
        res.status(404).json({ error: 'No active mission for this accident' });
        return;
    }
    res.json({
        payload: {
            accidentId: mission.accidentId,
            entityId: mission.entityId,
            phase: mission.phase,
            sceneLocation: mission.sceneLocation,
            hospital: mission.hospital ? {
                hospitalId: mission.hospital.hospitalId,
                name: mission.hospital.name,
                location: mission.hospital.location,
                phone: mission.hospital.phone,
                distanceKm: mission.hospital.distanceKm,
                mapLink: `https://www.google.com/maps?q=${mission.hospital.location.lat},${mission.hospital.location.lng}`,
            } : null,
            arrivedAtSceneAt: mission.arrivedAtSceneAt,
            arrivedAtHospitalAt: mission.arrivedAtHospitalAt,
        },
    });
});

// POST /api/corridor/missions/:accidentId/go-to-hospital — trigger hospital routing
corridorRouter.post('/missions/:accidentId/go-to-hospital', (req: Request, res: Response) => {
    const { hospitalId } = req.body ?? {};
    const mission = corridorEngine.startHospitalRouting(req.params.accidentId, hospitalId);

    if (!mission) {
        res.status(404).json({ error: 'No active mission for this accident. Ensure ambulance has sent at least one location update.' });
        return;
    }

    if (!mission.hospital) {
        res.status(500).json({ error: 'No available hospital found nearby' });
        return;
    }

    const hospitalMapLink = `https://www.google.com/maps?q=${mission.hospital.location.lat},${mission.hospital.location.lng}`;

    res.json({
        payload: {
            accidentId: mission.accidentId,
            phase: mission.phase,
            hospital: {
                hospitalId: mission.hospital.hospitalId,
                name: mission.hospital.name,
                location: mission.hospital.location,
                phone: mission.hospital.phone,
                distanceKm: mission.hospital.distanceKm,
                mapLink: hospitalMapLink,
                navigationLink: `https://www.google.com/maps/dir/?api=1&destination=${mission.hospital.location.lat},${mission.hospital.location.lng}`,
            },
            message: `Ambulance now routing to ${mission.hospital.name}. Green corridor active.`,
        },
    });
});
