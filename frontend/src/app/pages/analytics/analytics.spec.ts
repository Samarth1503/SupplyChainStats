import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Stats } from '../../models';
import { Analytics } from './analytics';

const stats: Stats = {
  totalShipments: 82,
  totalWeightKg: 1234.5,
  totalRevenueUsd: 9876.54,
  byStatus: { Arrived: 46, 'In transit': 18, Scheduled: 18 },
  byMode: {
    Plane: { shipments: 50, weightKg: 600, avgTransitDays: 2.5 },
    Ferry: { shipments: 32, weightKg: 634.5, avgTransitDays: 23.1 },
  },
  byDestination: [
    { destinationCountry: 'England', shipments: 18, weightKg: 300 },
    { destinationCountry: 'Japan', shipments: 9, weightKg: 150 },
  ],
  monthly: [
    { month: '2026-08', shipments: 10 },
    { month: '2026-09', shipments: 20 },
  ],
};

const isStatsRequest = (request: HttpRequest<unknown>) => request.url === 'http://localhost:3000/api/stats';

function setup() {
  TestBed.configureTestingModule({
    imports: [Analytics],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(Analytics);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, page: fixture.nativeElement as HTMLElement };
}

describe('Analytics', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('FE-12 shows loading, then KPI cards and bars from the statistics', () => {
    const { fixture, http, page } = setup();
    expect(page.textContent).toContain('Loading statistics');

    http.expectOne(isStatsRequest).flush(stats);
    fixture.detectChanges();

    const text = page.textContent ?? '';
    expect(text).not.toContain('Loading statistics');
    expect(text).toContain('82');
    expect(text).toContain('1,234.5 kg');
    expect(text).toContain('$9,877');
    expect(text).toContain('2.5 days');
    expect(text).toContain('23.1 days');
    expect(page.querySelectorAll('.chart').length).toBe(3);

    const widths = Array.from(page.querySelectorAll('.chart')[0].querySelectorAll('.bar-fill')).map(
      (bar) => (bar as HTMLElement).style.width,
    );
    // Arrived 46 is the biggest (100%), In transit 18 -> 39%, Scheduled 18 -> 39%
    expect(widths).toEqual(['100%', '39%', '39%']);
    expect(text).toContain('Aug 2026');
  });

  it('FE-13 shows an error message and recovers with Try again', () => {
    const { fixture, http, page } = setup();
    http.expectOne(isStatsRequest).flush({ error: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const banner = page.querySelector('.message.error') as HTMLElement;
    expect(banner.textContent).toContain('The server had a problem.');
    expect(page.querySelector('.chart')).toBeNull();

    (banner.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne(isStatsRequest).flush(stats);
    fixture.detectChanges();

    expect(page.querySelector('.message.error')).toBeNull();
    expect(page.querySelectorAll('.chart').length).toBe(3);
  });

  it('FE-13 shows a message when the server cannot be reached', () => {
    const { fixture, http, page } = setup();
    http.expectOne(isStatsRequest).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(page.querySelector('.message.error')?.textContent).toContain('Cannot reach the server');
  });

  it('FE-13 shows "No data" and no NaN when there are zero shipments', () => {
    const { fixture, http, page } = setup();
    http.expectOne(isStatsRequest).flush({
      totalShipments: 0,
      totalWeightKg: 0,
      totalRevenueUsd: 0,
      byStatus: { Arrived: 0, 'In transit': 0, Scheduled: 0 },
      byMode: {
        Plane: { shipments: 0, weightKg: 0, avgTransitDays: 0 },
        Ferry: { shipments: 0, weightKg: 0, avgTransitDays: 0 },
      },
      byDestination: [],
      monthly: [],
    });
    fixture.detectChanges();

    expect(page.textContent).toContain('No data to show yet.');
    expect(page.textContent).not.toContain('NaN');
    expect(page.querySelector('.chart')).toBeNull();
  });

  it('FE-13 handles an unexpected response shape', () => {
    const { fixture, http, page } = setup();
    http.expectOne(isStatsRequest).flush({ hello: 'world' });
    fixture.detectChanges();
    expect(page.querySelector('.message.error')?.textContent).toContain('Something went wrong');
  });
});
