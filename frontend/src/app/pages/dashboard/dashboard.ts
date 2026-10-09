import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CustomerLevel, Destination, Shipment, ShipmentMode, Tariff } from '../../models';
import { ApiService } from '../../services/api';

const ROWS_IN_SUMMARY = 5;
const MODES: ShipmentMode[] = ['Plane', 'Ferry'];
const MODE_ICONS: Record<ShipmentMode, string> = { Plane: '✈️', Ferry: '🚢' };

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  private api = inject(ApiService);

  // State shown on the page. Signals tell Angular when to update the screen.
  destinations = signal<Destination[]>([]);
  selectedCountry = signal('');
  shipments = signal<Shipment[] | null>(null); // null = not available (yet)
  tariff = signal<Tariff | null>(null);
  level = signal<CustomerLevel | null>(null);
  loading = signal(false);
  errorMessage = signal('');
  showAll = signal(false);

  // Values calculated from the state above.
  selectedCity = computed(
    () => this.destinations().find((d) => d.country === this.selectedCountry())?.city ?? '',
  );
  selectedCode = computed(
    () => this.destinations().find((d) => d.country === this.selectedCountry())?.code ?? '',
  );

  tables = computed(() => {
    const all = this.shipments() ?? [];
    return MODES.map((mode) => {
      const ofMode = all.filter((shipment) => shipment.mode === mode);
      return {
        mode: mode,
        icon: MODE_ICONS[mode],
        total: ofMode.length,
        rows: this.showAll() ? ofMode : ofMode.slice(-ROWS_IN_SUMMARY),
      };
    });
  });

  canShowAll = computed(() => this.tables().some((table) => table.total > ROWS_IN_SUMMARY));

  kgToGo = computed(() => {
    const level = this.level();
    return level ? Math.max(0, level.kgRequiredForRenewal - level.kgBought) : 0;
  });

  progressPercent = computed(() => {
    const level = this.level();
    if (!level || level.kgRequiredForRenewal <= 0) return 0;
    return Math.min(100, Math.round((level.kgBought / level.kgRequiredForRenewal) * 100));
  });

  // Running requests, so they can be cancelled when they are no longer needed.
  private levelRequest?: Subscription;
  private destinationsRequest?: Subscription;
  private shipmentsRequest?: Subscription;
  private tariffRequest?: Subscription;

  ngOnInit() {
    this.loadLevel();
    this.loadDestinations();
  }

  ngOnDestroy() {
    this.levelRequest?.unsubscribe();
    this.destinationsRequest?.unsubscribe();
    this.cancelCountryRequests();
  }

  onDestinationChange(event: Event) {
    const country = (event.target as HTMLSelectElement).value;
    this.errorMessage.set('');
    this.loadCountryData(country);
  }

  toggleShowAll() {
    this.showAll.update((value) => !value);
  }

  tryAgain() {
    this.errorMessage.set('');
    if (this.level() === null) this.loadLevel();
    if (this.destinations().length === 0) {
      this.loadDestinations();
    } else {
      this.loadCountryData(this.selectedCountry());
    }
  }

  private loadLevel() {
    this.levelRequest?.unsubscribe();
    this.levelRequest = this.api.getLevel().subscribe({
      next: (level) => {
        if (!level || typeof level.kgBought !== 'number') {
          this.showError(undefined);
          return;
        }
        this.level.set(level);
      },
      error: (error) => this.showError(error),
    });
  }

  private loadDestinations() {
    this.destinationsRequest?.unsubscribe();
    this.loading.set(true);
    this.destinationsRequest = this.api.getDestinations().subscribe({
      next: (destinations) => {
        if (!Array.isArray(destinations) || destinations.length === 0) {
          this.loading.set(false);
          this.showError(undefined);
          return;
        }
        this.destinations.set(destinations);
        this.loadCountryData(destinations[0].country);
      },
      error: (error) => {
        this.loading.set(false);
        this.showError(error);
      },
    });
  }

  private loadCountryData(country: string) {
    this.cancelCountryRequests(); // an older, slower answer must not replace the newer one
    this.selectedCountry.set(country);
    this.shipments.set(null);
    this.tariff.set(null);
    this.loading.set(true);

    this.shipmentsRequest = this.api.getShipments(country).subscribe({
      next: (shipments) => {
        this.loading.set(false);
        if (!Array.isArray(shipments)) {
          this.showError(undefined);
          return;
        }
        this.shipments.set(shipments);
      },
      error: (error) => {
        this.loading.set(false);
        this.showError(error);
      },
    });

    this.tariffRequest = this.api.getTariff(country).subscribe({
      next: (tariff) => {
        if (!tariff || typeof tariff.planePerKg !== 'number') {
          this.showError(undefined);
          return;
        }
        this.tariff.set(tariff);
      },
      error: (error) => this.showError(error),
    });
  }

  private cancelCountryRequests() {
    this.shipmentsRequest?.unsubscribe();
    this.tariffRequest?.unsubscribe();
  }

  private showError(error: unknown) {
    let message = 'Something went wrong. Please try again.';
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        message = 'Cannot reach the server. Is the backend running?';
      } else if (error.status === 400) {
        message = 'The request was not valid.';
      } else if (error.status === 404) {
        message = 'The requested data was not found.';
      } else if (error.status >= 500) {
        message = 'The server had a problem. Please try again.';
      }
    }
    this.errorMessage.set(message);
  }
}
