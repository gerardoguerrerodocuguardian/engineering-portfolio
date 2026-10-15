import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { campaign } from '../../testing';
import { CampaignActions } from '../../store/campaign.actions';
import { adapter, initialState } from '../../store/campaign.reducer';
import { CampaignListComponent } from './campaign-list.component';

describe('CampaignListComponent', () => {
  function setup(over = {}) {
    TestBed.configureTestingModule({
      imports: [CampaignListComponent],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            campaigns: adapter.setAll([campaign({ id: 'a', name: 'Alpha' }), campaign({ id: 'b', name: 'Beta', status: 'PAUSED' })], {
              ...initialState,
              total: 25,
              ...over,
            }),
          },
        }),
      ],
    });
    const dispatch = jest.spyOn(TestBed.inject(MockStore), 'dispatch');
    const fixture = TestBed.createComponent(CampaignListComponent);
    fixture.detectChanges();
    return { fixture, dispatch, el: fixture.nativeElement as HTMLElement };
  }

  it('renders rows and dispatches opened on init', () => {
    const { el, dispatch } = setup();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Alpha');
    expect(dispatch).toHaveBeenCalledWith(CampaignActions.opened());
  });

  it('dispatches a filter change from the labelled select', () => {
    const { el, dispatch, fixture } = setup();
    const select = el.querySelector<HTMLSelectElement>('#status-filter')!;
    expect(el.querySelector('label[for="status-filter"]')).not.toBeNull();
    select.value = 'PAUSED';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(dispatch).toHaveBeenCalledWith(CampaignActions.statusFilterChanged({ status: 'PAUSED' }));
  });

  it('paginates with next and disables previous on the first page', () => {
    const { el, dispatch, fixture } = setup();
    const [prev, next] = Array.from(el.querySelectorAll<HTMLButtonElement>('nav.pager button'));
    expect(prev.disabled).toBe(true);
    next.click();
    fixture.detectChanges();
    expect(dispatch).toHaveBeenCalledWith(CampaignActions.pageChanged({ page: 2 }));
  });

  it('asks for confirmation (local signal) before deleting', () => {
    const { el, dispatch, fixture } = setup();
    el.querySelector<HTMLButtonElement>('button[aria-label="Delete Alpha"]')!.click();
    fixture.detectChanges();
    expect(dispatch).not.toHaveBeenCalledWith(CampaignActions.deleteRequested({ id: 'a' }));
    el.querySelector<HTMLButtonElement>('[role="alertdialog"] .danger')!.click();
    expect(dispatch).toHaveBeenCalledWith(CampaignActions.deleteRequested({ id: 'a' }));
  });
});
