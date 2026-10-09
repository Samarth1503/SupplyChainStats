const express = require('express');
const data = require('./data/logistics.json');

const app = express();

const VALID_MODES = ['Plane', 'Ferry'];

// Middleware: allow the Angular pages (other ports) to call this API from the browser.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

// Reads and checks ?destination=... . Sends the error response itself and returns null when invalid.
function getValidDestination(req, res) {
  const value = req.query.destination;

  if (typeof value !== 'string' || value.trim() === '') {
    res.status(400).json({ error: 'Query parameter "destination" is required' });
    return null;
  }

  const destination = data.destinations.find((item) => item.country === value);
  if (!destination) {
    res.status(404).json({ error: 'Destination not found: ' + value });
    return null;
  }

  return destination;
}

function roundTo(number, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(number * factor) / factor;
}

function transitDays(shipment) {
  return (Date.parse(shipment.arrivalDate) - Date.parse(shipment.departureDate)) / 86400000;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/destinations', (req, res) => {
  res.json(data.destinations);
});

app.get('/api/shipments', (req, res) => {
  const destination = getValidDestination(req, res);
  if (!destination) return;

  const mode = req.query.mode;
  if (mode !== undefined && !VALID_MODES.includes(mode)) {
    res.status(400).json({ error: 'Query parameter "mode" must be Plane or Ferry' });
    return;
  }

  const shipments = data.shipments
    .filter((shipment) => shipment.destinationCountry === destination.country)
    .filter((shipment) => mode === undefined || shipment.mode === mode)
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate));

  res.json(shipments);
});

app.get('/api/tariffs', (req, res) => {
  const destination = getValidDestination(req, res);
  if (!destination) return;

  const tariff = data.tariffs.find((item) => item.destinationCountry === destination.country);
  res.json(tariff);
});

app.get('/api/level', (req, res) => {
  res.json(data.customerLevel);
});

app.get('/api/stats', (req, res) => {
  const shipments = data.shipments;

  const byStatus = { Arrived: 0, 'In transit': 0, Scheduled: 0 };
  shipments.forEach((shipment) => {
    byStatus[shipment.status] += 1;
  });

  const byMode = {};
  VALID_MODES.forEach((mode) => {
    const ofMode = shipments.filter((shipment) => shipment.mode === mode);
    const totalDays = ofMode.reduce((sum, shipment) => sum + transitDays(shipment), 0);
    byMode[mode] = {
      shipments: ofMode.length,
      weightKg: roundTo(ofMode.reduce((sum, shipment) => sum + shipment.weightKg, 0), 1),
      avgTransitDays: ofMode.length === 0 ? 0 : roundTo(totalDays / ofMode.length, 1),
    };
  });

  const byDestination = data.destinations.map((destination) => {
    const ofDestination = shipments.filter(
      (shipment) => shipment.destinationCountry === destination.country
    );
    return {
      destinationCountry: destination.country,
      shipments: ofDestination.length,
      weightKg: roundTo(ofDestination.reduce((sum, shipment) => sum + shipment.weightKg, 0), 1),
    };
  });

  const monthCounts = {};
  shipments.forEach((shipment) => {
    const month = shipment.departureDate.slice(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  const monthly = Object.keys(monthCounts)
    .sort()
    .map((month) => ({ month: month, shipments: monthCounts[month] }));

  res.json({
    totalShipments: shipments.length,
    totalWeightKg: roundTo(shipments.reduce((sum, shipment) => sum + shipment.weightKg, 0), 1),
    totalRevenueUsd: roundTo(shipments.reduce((sum, shipment) => sum + shipment.costUsd, 0), 2),
    byStatus: byStatus,
    byMode: byMode,
    byDestination: byDestination,
    monthly: monthly,
  });
});

// Any other path or HTTP method.
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Unexpected errors (the 4 parameters tell Express this is the error handler).
app.use((error, req, res, next) => {
  console.error('Unexpected error:', error.message);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

module.exports = app;
