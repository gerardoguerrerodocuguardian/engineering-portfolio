import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { AGGREGATOR_FACTORY, InlineAggregator } from './core/aggregator-port';
import { WorkerAggregator } from './core/worker-aggregator';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // No zone.js: change detection is driven by signals and markForCheck-style notifications only.
    provideZonelessChangeDetection(),
    { provide: AGGREGATOR_FACTORY, useValue: () => (typeof Worker !== 'undefined' ? new WorkerAggregator() : new InlineAggregator()) },
  ],
};
