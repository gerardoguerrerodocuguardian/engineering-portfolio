import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { CampaignApiService } from '../core/campaign-api.service';
import { campaign } from '../testing';
import { CampaignActions as A } from './campaign.actions';
import { CampaignEffects } from './campaign.effects';
import { initialState } from './campaign.reducer';

describe('CampaignEffects', () => {
  let actions$: Observable<unknown>;
  const api = { list: jest.fn(), create: jest.fn(), get: jest.fn(), update: jest.fn(), delete: jest.fn(), report: jest.fn() };
  const router = { navigate: jest.fn() };

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        CampaignEffects,
        provideMockActions(() => actions$),
        provideMockStore({ initialState: { campaigns: { ...initialState, page: 2, status: 'ACTIVE' } } }),
        { provide: CampaignApiService, useValue: api },
        { provide: Router, useValue: router },
      ],
    });
    return TestBed.inject(CampaignEffects);
  }

  beforeEach(() => jest.resetAllMocks());

  it('loads the current query page and maps success', (done) => {
    const result = { items: [campaign()], page: 2, pageSize: 10, total: 11 };
    api.list.mockReturnValue(of(result));
    actions$ = of(A.opened());
    setup().load$.subscribe((a) => {
      expect(api.list).toHaveBeenCalledWith(2, 10, 'ACTIVE');
      expect(a).toEqual(A.loadSuccess({ result }));
      done();
    });
  });

  it('maps a failing list call to loadFailure with the error message', (done) => {
    api.list.mockReturnValue(throwError(() => new Error('Service unavailable')));
    actions$ = of(A.pageChanged({ page: 2 }));
    setup().load$.subscribe((a) => {
      expect(a).toEqual(A.loadFailure({ error: 'Service unavailable' }));
      done();
    });
  });

  it('creates a campaign and navigates to the list', (done) => {
    const created = campaign({ id: 'new' });
    api.create.mockReturnValue(of(created));
    actions$ = of(A.createRequested({ body: { name: 'abc', dailyBudgetCents: 1, maxBidCents: 1 } }));
    const fx = setup();
    fx.create$.subscribe((a) => {
      expect(a).toEqual(A.createSuccess({ campaign: created }));
      actions$ = of(a);
      fx.navigateAfterSave$.subscribe(() => {
        expect(router.navigate).toHaveBeenCalledWith(['/campaigns']);
        done();
      });
    });
  });
});
