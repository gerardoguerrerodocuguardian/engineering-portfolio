import { ChangeDetectionStrategy, Component, DOCUMENT, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main" (click)="focusMain($event)">Skip to main content</a>
    <header class="site-header">
      <a class="brand" routerLink="/">AdFlow</a>
      <nav aria-label="Main">
        <a routerLink="/campaigns" routerLinkActive="active" ariaCurrentWhenActive="page">Campaigns</a>
      </nav>
      @if (auth.isAuthenticated()) {
        <button type="button" class="btn secondary" (click)="signOut()">Sign out</button>
      } @else {
        <a class="btn secondary" routerLink="/login">Sign in</a>
      }
    </header>
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    // Focus management for SPA navigation: move focus to the new page heading
    // so keyboard and screen reader users land on the new content. Skips the initial load.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (!this.isBrowser) return;
        setTimeout(() => {
          const target = this.document.querySelector<HTMLElement>('main h1') ?? this.document.getElementById('main');
          target?.focus();
        });
      });
  }

  protected focusMain(event: Event): void {
    event.preventDefault();
    this.document.getElementById('main')?.focus();
  }

  protected signOut(): void {
    this.auth.signOut();
    void this.router.navigate(['/']);
  }
}
