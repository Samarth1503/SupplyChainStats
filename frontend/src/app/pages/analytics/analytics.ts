import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Stats } from '../../models';
import { ApiService } from '../../services/api';

interface Bar {
  label: string;
  value: number;
  percent: number; // width of the bar, 0 to 100
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The biggest value gets a 100% wide bar, the others are scaled against it.
function makeBars(items: { label: string; value: number }[]): Bar[] {
  const max = Math.max(0, ...items.map((item) => item.value));
  return items.map((item) => ({
    label: item.label,
    value: item.value,
    percent: max === 0 ? 0 : Math.round((item.value / max) * 100),
  }));
}

function monthLabel(month: string): string {
  const [year, number] = month.split('-');
  return MONTH_NAMES[Number(number) - 1] + ' ' + year;
}

@Component({
  selector: 'app-analytics',
  imports: [DecimalPipe],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class Analytics implements OnInit, OnDestroy {
  private api = inject(ApiService);

  stats = signal<Stats | null>(null);
  loading = signal(true);
  errorMessage = signal('');

  charts = computed(() => {
    const stats = this.stats();
    if (!stats) return [];
    return [
      {
        title: 'Shipments by status',
        bars: makeBars(Object.entries(stats.byStatus).map(([label, value]) => ({ label, value }))),
      },
      {
        title: 'Shipments by destination',
        bars: makeBars(
          stats.byDestination.map((item) => ({ label: item.destinationCountry, value: item.shipments })),
        ),
      },
      {
        title: 'Shipments by departure month',
        bars: makeBars(stats.monthly.map((item) => ({ label: monthLabel(item.month), value: item.shipments }))),
      },
    ];
  });

  private request?: Subscription;

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');

    this.request = this.api.getStats().subscribe({
      next: (stats) => {
        this.loading.set(false);
        const looksValid =
          stats &&
          typeof stats.totalShipments === 'number' &&
          stats.byStatus &&
          stats.byMode &&
          Array.isArray(stats.byDestination) &&
          Array.isArray(stats.monthly);
        if (!looksValid) {
          this.showError(undefined);
          return;
        }
        this.stats.set(stats);
      },
      error: (error) => {
        this.loading.set(false);
        this.showError(error);
      },
    });
  }

  private showError(error: unknown) {
    let message = 'Something went wrong. Please try again.';
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        message = 'Cannot reach the server. Is the backend running?';
      } else if (error.status === 404) {
        message = 'The requested data was not found.';
      } else if (error.status >= 500) {
        message = 'The server had a problem. Please try again.';
      }
    }
    this.errorMessage.set(message);
  }
}
