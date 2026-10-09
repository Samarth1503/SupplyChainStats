import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests shipments with the destination as query parameter', () => {
    api.getShipments('England').subscribe();
    const request = http.expectOne((r) => r.url === 'http://localhost:3000/api/shipments');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('destination')).toBe('England');
    expect(request.request.urlWithParams).toContain('destination=Great%20Britain');
    request.flush([]);
  });

  it('requests tariffs, destinations, level and stats from the right URLs', () => {
    api.getTariff('Japan').subscribe();
    api.getDestinations().subscribe();
    api.getLevel().subscribe();
    api.getStats().subscribe();

    http.expectOne((r) => r.url.endsWith('/api/tariffs') && r.params.get('destination') === 'Japan').flush({});
    http.expectOne('http://localhost:3000/api/destinations').flush([]);
    http.expectOne('http://localhost:3000/api/level').flush({});
    http.expectOne('http://localhost:3000/api/stats').flush({});
  });
});
