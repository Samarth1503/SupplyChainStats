import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerLevel, Destination, Shipment, ShipmentMode, Tariff } from '../../models';
import { Dashboard } from './dashboard';

const destinations: Destination[] = [
  { country: 'England', city: 'London', code: 'GB' },
  { country: 'Germany', city: 'Hamburg', code: 'DE' },
  { country: 'USA', city: 'New York', code: 'US' },
  { country: 'Japan', city: 'Tokyo', code: 'JP' },
];

const level: CustomerLevel = {
  levelName: 'Gold',
  validUntil: '2026-12-31',
  friendPaymentPercent: 5,
  redemptionPercent: 10,
  kgBought: 70,
  kgRequiredForRenewal: 100,
  renewalDeadline: '2026-12-31',
};

const gbTariff: Tariff = { destinationCountry: '', planePerKg: 14, ferryPerKg: 4.7 };

function makeShipments(mode: ShipmentMode, count: number, country = ''): Shipment[] {
  const statuses = ['Arrived', 'In transit', 'Scheduled'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: mode + '-' + country + '-' + i,
    mode: mode,
    destinationCountry: country,
    departureDate: '2026-07-' + String(10 + i).padStart(2, '0'),
    arrivalDate: '2026-07-' + String(12 + i).padStart(2, '0'),
    status: statuses[i % 3],
    weightKg: 10,
    costUsd: 140,
  }));
}

const gbShipments = [...makeShipments('Plane', 8), ...makeShipments('Ferry', 8)];

// Matches a request to the API, optionally for one destination.
function isRequest(path: string, country?: string) {
  return (request: HttpRequest<unknown>) =>
    request.url === 'http://localhost:3000/api/' + path &&
    (country === undefined || request.params.get('destination') === country);
}

function setup() {
  TestBed.configureTestingModule({
    imports: [Dashboard],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(Dashboard);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges(); // creates the page and runs ngOnInit -> sends the first requests
  return { fixture, http };
}

// Answers the four requests the page sends when it opens.
function answerStartup(
  fixture: ComponentFixture<Dashboard>,
  http: HttpTestingController,
  shipments: Shipment[] = gbShipments,
  tariff: Tariff = gbTariff,
) {
  http.expectOne(isRequest('level')).flush(level);
  http.expectOne(isRequest('destinations')).flush(destinations);
  http.expectOne(isRequest('shipments', '')).flush(shipments);
  http.expectOne(isRequest('tariffs', '')).flush(tariff);
  fixture.detectChanges();
}

function page(fixture: ComponentFixture<Dashboard>) {
  return fixture.nativeElement as HTMLElement;
}

function rowsOfTable(fixture: ComponentFixture<Dashboard>, index: number) {
  return page(fixture).querySelectorAll('.mode-table')[index].querySelectorAll('tbody tr');
}

function chooseDestination(fixture: ComponentFixture<Dashboard>, country: string) {
  const select = page(fixture).querySelector('select') as HTMLSelectElement;
  select.value = country;
  select.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

describe('Dashboard', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify(); // no unexpected requests left over
  });

  it('FE-02 renders the scoreboard with data', () => {
    const { fixture, http } = setup();
    answerStartup(fixture, http);
    const text = page(fixture).textContent ?? '';

    expect(text).toContain('Online postal scoreboard');
    expect(page(fixture).querySelectorAll('.mode-table').length).toBe(2);
    expect(text).toContain('Plane');
    expect(text).toContain('Ferry');
    const headings = Array.from(page(fixture).querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headings.slice(0, 3)).toEqual(['China', 'London', 'Status']);

    // Plane list has 8 rows, the last 5 are shown: index 3..7 -> departs 13.07 ... 17.07
    const firstRow = rowsOfTable(fixture, 0)[0];
    expect(firstRow.textContent).toContain('13.07');
    expect(firstRow.textContent).toContain('15.07');
    expect(firstRow.textContent).toContain('Arrived');
    expect(text).toContain('In transit');
    expect(text).toContain('Scheduled');
    expect((page(fixture).querySelector('select') as HTMLSelectElement).value).toBe('');
  });

  it('FE-03 shows 5 rows and "All schedule" shows everything', () => {
    const { fixture, http } = setup();
    answerStartup(fixture, http);
    expect(rowsOfTable(fixture, 0).length).toBe(5);
    expect(rowsOfTable(fixture, 1).length).toBe(5);

    const button = page(fixture).querySelector('.more button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('All schedule');
    button.click();
    fixture.detectChanges();
    expect(rowsOfTable(fixture, 0).length).toBe(8);
    expect(rowsOfTable(fixture, 1).length).toBe(8);
    expect(button.textContent?.trim()).toBe('Show less');

    button.click();
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('All schedule');
  });

  it('FE-03 hides the button when there are 5 or fewer rows', () => {
    const { fixture, http } = setup();
    answerStartup(fixture, http, [...makeShipments('Plane', 3), ...makeShipments('Ferry', 2)]);
    expect(page(fixture).querySelector('.more button')).toBeNull();
  });

  it('FE-04 changing the destination requests the new destination', () => {
    const { fixture, http } = setup();
    answerStartup(fixture, http);

    chooseDestination(fixture, 'Germany');
    http.expectOne(isRequest('shipments', 'Germany')).flush(makeShipments('Plane', 2, 'Germany'));
    http.expectOne(isRequest('tariffs', 'Germany')).flush({
      destinationCountry: 'Germany',
      planePerKg: 12,
      ferryPerKg: 4.2,
    });
    fixture.detectChanges();

    const headings = Array.from(page(fixture).querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headings.slice(0, 3)).toEqual(['China', 'Hamburg', 'Status']);
    expect(page(fixture).textContent).toContain('$12');
    expect(page(fixture).querySelector('.code-badge')?.textContent?.trim()).toBe('DE');
  });

  it('FE-05 switching quickly cancels the older request and shows only the newest', () => {
    const { fixture, http } = setup();
    answerStartup(fixture, http);

    chooseDestination(fixture, 'Germany');
    const germanyShipments = http.expectOne(isRequest('shipments', 'Germany'));
    const germanyTariff = http.expectOne(isRequest('tariffs', 'Germany'));

    chooseDestination(fixture, 'USA');
    expect(germanyShipments.cancelled).toBe(true);
    expect(germanyTariff.cancelled).toBe(true);

    http.expectOne(isRequest('shipments', 'USA')).flush(makeShipments('Plane', 2, 'USA'));
    http.expectOne(isRequest('tariffs', 'USA')).flush({
      destinationCountry: 'USA',
      planePerKg: 18,
      ferryPerKg: 5.5,
    });
    fixture.detectChanges();

    const headings = Array.from(page(fixture).querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(headings[1]).toBe('New York');
    expect(page(fixture).textContent).toContain('$18');
    expect(page(fixture).textContent).not.toContain('Hamburg');
  });

  it('FE-06 shows a message when a table has no shipments', () => {
    const { fixture, http } = setup();
    answerStartup(fixture, http, makeShipments('Plane', 6));

    expect(rowsOfTable(fixture, 0).length).toBe(5);
    const ferryTable = page(fixture).querySelectorAll('.mode-table')[1];
    expect(ferryTable.textContent).toContain('No ferry shipments to this destination.');
    expect(ferryTable.querySelector('table')).toBeNull();
    expect(page(fixture).querySelector('.message.error')).toBeNull();
  });

  const errorCases = [
    { status: 400, text: 'The request was not valid.' },
    { status: 404, text: 'The requested data was not found.' },
    { status: 500, text: 'The server had a problem.' },
  ];

  for (const errorCase of errorCases) {
    it('FE-07 shows a friendly message for HTTP ' + errorCase.status + ' and recovers with Try again', () => {
      const { fixture, http } = setup();
      http.expectOne(isRequest('level')).flush(level);
      http.expectOne(isRequest('destinations')).flush(destinations);
      http.expectOne(isRequest('shipments', '')).flush(
        { error: 'x' },
        { status: errorCase.status, statusText: 'Error' },
      );
      http.expectOne(isRequest('tariffs', '')).flush(gbTariff);
      fixture.detectChanges();

      const banner = page(fixture).querySelector('.message.error') as HTMLElement;
      expect(banner.textContent).toContain(errorCase.text);
      expect(page(fixture).textContent).toContain('Online postal scoreboard');
      expect(page(fixture).querySelector('table')).toBeNull();

      (banner.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectOne(isRequest('shipments', '')).flush(gbShipments);
      http.expectOne(isRequest('tariffs', '')).flush(gbTariff);
      fixture.detectChanges();

      expect(page(fixture).querySelector('.message.error')).toBeNull();
      expect(rowsOfTable(fixture, 0).length).toBe(5);
    });
  }

  it('FE-08 shows a message when the server cannot be reached', () => {
    const { fixture, http } = setup();
    http.expectOne(isRequest('level')).error(new ProgressEvent('error'));
    http.expectOne(isRequest('destinations')).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(page(fixture).querySelector('.message.error')?.textContent).toContain('Cannot reach the server');
    expect(page(fixture).textContent).toContain('Online postal scoreboard');
    expect(page(fixture).querySelector('select')).toBeNull();
    expect(page(fixture).textContent).not.toContain('Loading shipments');
  });

  const badShapes: { name: string; body: unknown }[] = [
    { name: 'null', body: null },
    { name: 'an object', body: {} },
    { name: 'a string', body: 'oops' },
  ];

  for (const badShape of badShapes) {
    it('FE-09 handles a shipments response that is ' + badShape.name, () => {
      const { fixture, http } = setup();
      http.expectOne(isRequest('level')).flush(level);
      http.expectOne(isRequest('destinations')).flush(destinations);
      http.expectOne(isRequest('shipments', '')).flush(badShape.body as never);
      http.expectOne(isRequest('tariffs', '')).flush(gbTariff);
      fixture.detectChanges();

      expect(page(fixture).querySelector('.message.error')?.textContent).toContain('Something went wrong');
      expect(page(fixture).querySelector('table')).toBeNull();
    });
  }

  it('FE-09 handles an empty destinations response', () => {
    const { fixture, http } = setup();
    http.expectOne(isRequest('level')).flush(level);
    http.expectOne(isRequest('destinations')).flush([]);
    fixture.detectChanges();

    expect(page(fixture).querySelector('.message.error')).not.toBeNull();
    expect(page(fixture).querySelector('select')).toBeNull();
  });

  it('FE-10 shows a loading text until the shipments arrive', () => {
    const { fixture, http } = setup();
    http.expectOne(isRequest('level')).flush(level);
    http.expectOne(isRequest('destinations')).flush(destinations);
    fixture.detectChanges();
    expect(page(fixture).textContent).toContain('Loading shipments');
    expect(page(fixture).querySelector('table')).toBeNull();

    http.expectOne(isRequest('shipments', '')).flush(gbShipments);
    http.expectOne(isRequest('tariffs', '')).flush(gbTariff);
    fixture.detectChanges();
    expect(page(fixture).textContent).not.toContain('Loading shipments');
    expect(page(fixture).querySelector('table')).not.toBeNull();
  });

  it('FE-11 shows the level card, tariffs, fees and progress', () => {
    const { fixture, http } = setup();
    answerStartup(fixture, http);
    const card = page(fixture).querySelector('.level-card') as HTMLElement;
    const text = card.textContent ?? '';

    expect(text).toContain('Gold');
    expect(text).toContain('31/12/2026');
    expect(text).toContain('$14');
    expect(text).toContain('$4.7');
    expect(text).toContain('5%');
    expect(text).toContain('10%');
    expect(text).toContain('buy another');
    expect(text).toContain('30 kg');
    expect((card.querySelector('.progress-bar') as HTMLElement).style.width).toBe('70%');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('null');
  });

  it('FE-11 shows "Not available" when a destination has no ferry tariff', () => {
    const { fixture, http } = setup();
    answerStartup(fixture, http);

    chooseDestination(fixture, 'Japan');
    http.expectOne(isRequest('shipments', 'Japan')).flush(makeShipments('Plane', 3, 'Japan'));
    http.expectOne(isRequest('tariffs', 'Japan')).flush({
      destinationCountry: 'Japan',
      planePerKg: 11,
      ferryPerKg: null,
    });
    fixture.detectChanges();

    const text = page(fixture).querySelector('.level-card')?.textContent ?? '';
    expect(text).toContain('$11');
    expect(text).toContain('Not available');
    expect(text).not.toContain('null');
    expect(page(fixture).textContent).toContain('No ferry shipments to this destination.');
  });

  it('FE-11 shows "Level secured" when the kg goal is reached', () => {
    const { fixture, http } = setup();
    http.expectOne(isRequest('level')).flush({ ...level, kgBought: 120 });
    http.expectOne(isRequest('destinations')).flush(destinations);
    http.expectOne(isRequest('shipments', '')).flush(gbShipments);
    http.expectOne(isRequest('tariffs', '')).flush(gbTariff);
    fixture.detectChanges();

    const card = page(fixture).querySelector('.level-card') as HTMLElement;
    expect(card.textContent).toContain('Level secured');
    expect(card.textContent).not.toContain('buy another');
    expect((card.querySelector('.progress-bar') as HTMLElement).style.width).toBe('100%');
  });
});
