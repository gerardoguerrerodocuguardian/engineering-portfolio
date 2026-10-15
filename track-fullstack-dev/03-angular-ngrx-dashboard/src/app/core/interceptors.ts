import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { AuthService } from './auth.service';
import { Problem } from './models';
import { ProblemError } from './problem-error';

/** Adds the bearer token, only for requests to our own API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (!token || !req.url.startsWith(inject(API_BASE_URL))) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/** Maps RFC 7807 problem+json (or anything else) to a ProblemError; 401 signs the user out. */
export const problemInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      if (err.status === 401) {
        auth.signOut();
        void router.navigate(['/login']);
      }
      return throwError(() => new ProblemError(toProblem(err)));
    }),
  );
};

export function toProblem(err: HttpErrorResponse): Problem {
  const body = err.error as Partial<Problem> | null;
  if (body && typeof body === 'object' && typeof body.title === 'string') {
    return { type: body.type ?? 'about:blank', title: body.title, status: body.status ?? err.status, detail: body.detail };
  }
  if (err.status === 0) {
    return { type: 'about:blank', title: 'Network error', status: 0, detail: 'The API is unreachable.' };
  }
  return { type: 'about:blank', title: err.statusText || 'Request failed', status: err.status };
}
