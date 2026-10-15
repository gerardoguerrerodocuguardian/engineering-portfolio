import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { API_BASE_URL } from './api-config';
import { AuthService } from './auth.service';
import { authInterceptor, problemInterceptor } from './interceptors';
import { ProblemError } from './problem-error';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  const router = { navigate: jest.fn() };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, problemInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('adds the bearer token to API requests only', () => {
    TestBed.inject(AuthService).signInDemo();
    http.get('http://api.test/v1/campaigns').subscribe();
    http.get('http://other.test/x').subscribe();
    expect(ctrl.expectOne('http://api.test/v1/campaigns').request.headers.get('Authorization')).toMatch(/^Bearer /);
    expect(ctrl.expectOne('http://other.test/x').request.headers.has('Authorization')).toBe(false);
  });

  it('maps problem+json bodies to ProblemError', (done) => {
    http.get('http://api.test/v1/campaigns/zz').subscribe({
      error: (e: unknown) => {
        expect(e).toBeInstanceOf(ProblemError);
        expect((e as ProblemError).status).toBe(404);
        expect((e as ProblemError).message).toBe('No such campaign');
        done();
      },
    });
    ctrl.expectOne('http://api.test/v1/campaigns/zz').flush(
      { type: 'about:blank', title: 'Not Found', status: 404, detail: 'No such campaign' },
      { status: 404, statusText: 'Not Found' },
    );
  });

  it('signs out and redirects on 401', () => {
    const auth = TestBed.inject(AuthService);
    auth.signInDemo();
    http.get('http://api.test/v1/campaigns').subscribe({ error: () => undefined });
    ctrl.expectOne('http://api.test/v1/campaigns').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
