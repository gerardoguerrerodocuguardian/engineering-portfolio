import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, of, switchMap, tap, withLatestFrom } from 'rxjs';
import { CampaignApiService } from '../core/campaign-api.service';
import { CampaignActions as A } from './campaign.actions';
import { selectQuery } from './campaign.selectors';

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error';
}

@Injectable()
export class CampaignEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(CampaignApiService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  /** Any change of the query re-fetches; switchMap cancels the stale in-flight request. */
  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.opened, A.statusFilterChanged, A.pageChanged, A.deleteSuccess),
      withLatestFrom(this.store.select(selectQuery)),
      switchMap(([, q]) =>
        this.api.list(q.page, q.pageSize, q.status).pipe(
          map((result) => A.loadSuccess({ result })),
          catchError((e) => of(A.loadFailure({ error: message(e) }))),
        ),
      ),
    ),
  );

  readonly loadOne$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.loadOne),
      switchMap(({ id }) =>
        this.api.get(id).pipe(
          map((campaign) => A.loadOneSuccess({ campaign })),
          catchError((e) => of(A.loadOneFailure({ error: message(e) }))),
        ),
      ),
    ),
  );

  readonly create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.createRequested),
      exhaustMap(({ body }) =>
        this.api.create(body).pipe(
          map((campaign) => A.createSuccess({ campaign })),
          catchError((e) => of(A.saveFailure({ error: message(e) }))),
        ),
      ),
    ),
  );

  readonly update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.updateRequested),
      exhaustMap(({ id, body }) =>
        this.api.update(id, body).pipe(
          map((campaign) => A.updateSuccess({ campaign })),
          catchError((e) => of(A.saveFailure({ error: message(e) }))),
        ),
      ),
    ),
  );

  readonly delete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.deleteRequested),
      exhaustMap(({ id }) =>
        this.api.delete(id).pipe(
          map(() => A.deleteSuccess({ id })),
          catchError((e) => of(A.saveFailure({ error: message(e) }))),
        ),
      ),
    ),
  );

  readonly report$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.reportRequested),
      switchMap(({ id }) =>
        this.api.report(id).pipe(
          map((report) => A.reportSuccess({ report })),
          catchError((e) => of(A.reportFailure({ error: message(e) }))),
        ),
      ),
    ),
  );

  /** After a successful create/update, go back to the list. */
  readonly navigateAfterSave$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(A.createSuccess, A.updateSuccess),
        tap(() => void this.router.navigate(['/campaigns'])),
      ),
    { dispatch: false },
  );
}
