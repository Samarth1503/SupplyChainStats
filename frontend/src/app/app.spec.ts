import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('FE-01 renders the header with the two navigation links', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.brand')?.textContent).toContain('SupplyChainStats');
    const links = Array.from(page.querySelectorAll('.nav a')).map((a) => a.textContent?.trim());
    expect(links).toEqual(['Dashboard', 'Analytics']);
  });

  it('FE-14 shows the not-found page for an unknown URL (lazy loaded)', async () => {
    const harness = await RouterTestingHarness.create('/does-not-exist');
    const text = (harness.routeNativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Page not found');
    expect(text).toContain('Back to the dashboard');
  });
});
