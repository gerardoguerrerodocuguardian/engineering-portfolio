import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CAMPAIGN_STATUSES, Campaign, CampaignStatus } from '../../core/models';
import { CampaignActions } from '../../store/campaign.actions';
import { selectListVm } from '../../store/campaign.selectors';

@Component({
  selector: 'app-campaign-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let vm = vm$();
    <div class="toolbar">
      <h1 tabindex="-1">Campaigns</h1>
      <a class="btn" routerLink="new">New campaign</a>
    </div>

    <div class="field">
      <label for="status-filter">Filter by status</label>
      <select id="status-filter" [value]="vm.status ?? ''" (change)="onFilter($event)">
        <option value="">All statuses</option>
        @for (s of statuses; track s) {
          <option [value]="s" [selected]="s === vm.status">{{ s }}</option>
        }
      </select>
    </div>

    @if (vm.error) {
      <div class="alert" role="alert">
        {{ vm.error }}
        <button type="button" class="btn secondary" (click)="dismissError()">Dismiss</button>
      </div>
    }

    @if (pendingDelete(); as c) {
      <div class="alert" role="alertdialog" aria-labelledby="del-title">
        <p id="del-title">Delete campaign "{{ c.name }}"? This cannot be undone.</p>
        <button type="button" class="btn danger" (click)="confirmDelete(c)">Delete</button>
        <button type="button" class="btn secondary" (click)="pendingDelete.set(null)">Cancel</button>
      </div>
    }

    <p aria-live="polite" class="hint">
      @if (vm.loading) { Loading campaigns... } @else { {{ vm.total }} campaign(s) }
    </p>

    <table [attr.aria-busy]="vm.loading">
      <caption class="visually-hidden">Campaigns, page {{ vm.page }} of {{ vm.pageCount }}</caption>
      <thead>
        <tr>
          <th scope="col">Name</th><th scope="col">Status</th>
          <th scope="col">Daily budget</th><th scope="col">Max bid</th><th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        @for (c of vm.campaigns; track c.id) {
          <tr>
            <th scope="row">{{ c.name }}</th>
            <td><span class="status status-{{ c.status }}">{{ c.status }}</span></td>
            <td>{{ money(c.dailyBudgetCents) }}</td>
            <td>{{ money(c.maxBidCents) }}</td>
            <td>
              <a [routerLink]="[c.id, 'edit']" [attr.aria-label]="'Edit ' + c.name">Edit</a>
              <a [routerLink]="[c.id, 'report']" [attr.aria-label]="'Report for ' + c.name">Report</a>
              <button type="button" class="btn secondary" (click)="pendingDelete.set(c)" [attr.aria-label]="'Delete ' + c.name">Delete</button>
            </td>
          </tr>
        } @empty {
          @if (!vm.loading) {
            <tr><td colspan="5">No campaigns match this filter.</td></tr>
          }
        }
      </tbody>
    </table>

    <nav class="pager" aria-label="Pagination">
      <button type="button" class="btn secondary" [disabled]="!vm.hasPrev" (click)="goTo(vm.page - 1)">Previous</button>
      <span>Page {{ vm.page }} of {{ vm.pageCount }}</span>
      <button type="button" class="btn secondary" [disabled]="!vm.hasNext" (click)="goTo(vm.page + 1)">Next</button>
    </nav>
  `,
  styles: `td a { margin-right: .75rem; }`,
})
export class CampaignListComponent {
  private readonly store = inject(Store);

  /** Server state comes from NgRx... */
  protected readonly vm$ = this.store.selectSignal(selectListVm);
  /** ...transient UI state is a local signal. */
  protected readonly pendingDelete = signal<Campaign | null>(null);
  protected readonly statuses = CAMPAIGN_STATUSES;

  constructor() {
    this.store.dispatch(CampaignActions.opened());
  }

  protected onFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.dispatch(CampaignActions.statusFilterChanged({ status: (value || null) as CampaignStatus | null }));
  }

  protected goTo(page: number): void {
    this.store.dispatch(CampaignActions.pageChanged({ page }));
  }

  protected confirmDelete(c: Campaign): void {
    this.store.dispatch(CampaignActions.deleteRequested({ id: c.id }));
    this.pendingDelete.set(null);
  }

  protected dismissError(): void {
    this.store.dispatch(CampaignActions.errorDismissed());
  }

  protected money(cents: number): string {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }
}
