import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CustomerLevel, Destination, Shipment, Stats, Tariff } from '../models';

// Address of the Express API (see backend/server.js).
const API_URL = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getDestinations() {
    return this.http.get<Destination[]>(`${API_URL}/destinations`);
  }

  getShipments(destination: string) {
    return this.http.get<Shipment[]>(`${API_URL}/shipments`, { params: { destination } });
  }

  getTariff(destination: string) {
    return this.http.get<Tariff>(`${API_URL}/tariffs`, { params: { destination } });
  }

  getLevel() {
    return this.http.get<CustomerLevel>(`${API_URL}/level`);
  }

  getStats() {
    return this.http.get<Stats>(`${API_URL}/stats`);
  }
}
