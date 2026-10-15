import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 tabindex="-1">AdFlow campaign dashboard</h1>
    <p>Manage campaigns, track delivery and review performance reports.</p>
    <p class="hint">AdFlow is a fictional ad platform; all data is synthetic.</p>
    <a class="btn" routerLink="/campaigns">Open campaigns</a>
  `,
})
export class LandingComponent {}
