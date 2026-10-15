import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 tabindex="-1">Sign in</h1>
    <p>This demo uses a synthetic advertiser identity. No credentials are needed.</p>
    <button type="button" class="btn" (click)="signIn()">Continue as demo advertiser</button>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  signIn(): void {
    this.auth.signInDemo();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    // Only allow same-app relative URLs.
    void this.router.navigateByUrl(returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/campaigns');
  }
}
