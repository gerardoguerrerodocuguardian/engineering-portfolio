import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CAMPAIGN_STATUSES, CampaignStatus } from '../../core/models';
import { CampaignActions } from '../../store/campaign.actions';
import { campaignsFeature } from '../../store/campaign.reducer';
import { selectCampaignEntities } from '../../store/campaign.selectors';

const LABELS = {
  name: 'Name',
  dailyBudgetCents: 'Daily budget (cents)',
  maxBidCents: 'Max bid (cents)',
} as const;
type Field = keyof typeof LABELS;

@Component({
  selector: 'app-campaign-form',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 tabindex="-1">{{ isEdit() ? 'Edit campaign' : 'New campaign' }}</h1>

    @if (serverError(); as err) {
      <div class="alert" role="alert">{{ err }}</div>
    }

    @if (summary().length) {
      <div class="alert" role="alert" tabindex="-1" #summaryBox>
        <p>Please fix the following:</p>
        <ul>
          @for (e of summary(); track e.field) {
            <li><a [href]="'#' + e.field" (click)="focusField($event, e.field)">{{ e.message }}</a></li>
          }
        </ul>
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="card">
      <div class="field">
        <label for="name">Name</label>
        <input id="name" formControlName="name" autocomplete="off" required
               [attr.aria-invalid]="invalid('name')" aria-describedby="name-hint name-err" />
        <span id="name-hint" class="hint">3 to 120 characters.</span>
        <span id="name-err" class="error">{{ errorFor('name') }}</span>
      </div>

      <div class="field">
        <label for="dailyBudgetCents">Daily budget (cents)</label>
        <input id="dailyBudgetCents" type="number" inputmode="numeric" formControlName="dailyBudgetCents" required
               [attr.aria-invalid]="invalid('dailyBudgetCents')" aria-describedby="budget-err" />
        <span id="budget-err" class="error">{{ errorFor('dailyBudgetCents') }}</span>
      </div>

      <div class="field">
        <label for="maxBidCents">Max bid (cents)</label>
        <input id="maxBidCents" type="number" inputmode="numeric" formControlName="maxBidCents" required
               [attr.aria-invalid]="invalid('maxBidCents')" aria-describedby="bid-err" />
        <span id="bid-err" class="error">{{ errorFor('maxBidCents') }}</span>
      </div>

      <div class="field">
        <label for="keywords">Keywords</label>
        <input id="keywords" formControlName="keywords" aria-describedby="kw-hint" />
        <span id="kw-hint" class="hint">Comma separated, for example: shoes, running.</span>
      </div>

      @if (isEdit()) {
        <div class="field">
          <label for="status">Status</label>
          <select id="status" formControlName="status">
            @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
          </select>
        </div>
      }

      <button type="submit" class="btn" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Save campaign' }}</button>
      <a class="btn secondary" routerLink="/campaigns">Cancel</a>
    </form>
  `,
})
export class CampaignFormComponent {
  /** Bound from the `:id` route param (withComponentInputBinding). Undefined when creating. */
  readonly id = input<string>();

  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly summaryBox = viewChild<ElementRef<HTMLElement>>('summaryBox');

  protected readonly statuses = CAMPAIGN_STATUSES;
  protected readonly isEdit = computed(() => !!this.id());
  protected readonly saving = this.store.selectSignal(campaignsFeature.selectSaving);
  protected readonly serverError = this.store.selectSignal(campaignsFeature.selectError);
  private readonly entities = this.store.selectSignal(selectCampaignEntities);
  /** Local UI state: validation summary shown after a failed submit. */
  protected readonly summary = signal<{ field: Field; message: string }[]>([]);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]),
    dailyBudgetCents: this.fb.control(0, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]),
    maxBidCents: this.fb.control(1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]),
    keywords: this.fb.control(''),
    status: this.fb.control<CampaignStatus>('DRAFT'),
  });

  constructor() {
    this.store.dispatch(CampaignActions.errorDismissed());
    effect(() => {
      const id = this.id();
      if (id) this.store.dispatch(CampaignActions.loadOne({ id }));
    });
    // Populate the form once the campaign is in the store (edit mode).
    effect(() => {
      const id = this.id();
      const c = id ? this.entities()[id] : undefined;
      if (c && this.form.pristine) {
        this.form.patchValue({
          name: c.name,
          dailyBudgetCents: c.dailyBudgetCents,
          maxBidCents: c.maxBidCents,
          keywords: (c.keywords ?? []).join(', '),
          status: c.status,
        });
      }
    });
  }

  protected invalid(field: Field): boolean | null {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty) ? true : null;
  }

  protected errorFor(field: Field): string {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty) ? this.message(field) : '';
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.summary.set(
        (Object.keys(LABELS) as Field[])
          .filter((f) => this.form.controls[f].invalid)
          .map((field) => ({ field, message: `${LABELS[field]}: ${this.message(field)}` })),
      );
      // Move focus to the error summary so assistive tech announces it.
      setTimeout(() => this.summaryBox()?.nativeElement.focus());
      return;
    }
    this.summary.set([]);
    const v = this.form.getRawValue();
    const keywords = v.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    const body = { name: v.name.trim(), dailyBudgetCents: v.dailyBudgetCents, maxBidCents: v.maxBidCents, keywords };
    const id = this.id();
    this.store.dispatch(
      id
        ? CampaignActions.updateRequested({ id, body: { ...body, status: v.status } })
        : CampaignActions.createRequested({ body }),
    );
  }

  protected focusField(event: Event, field: Field): void {
    event.preventDefault();
    (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${field}`)?.focus();
  }

  private message(field: Field): string {
    const e = this.form.controls[field].errors ?? {};
    if (e['required']) return 'is required.';
    if (e['minlength']) return 'must be at least 3 characters.';
    if (e['maxlength']) return 'must be at most 120 characters.';
    if (e['pattern']) return 'must be a whole number.';
    if (e['min']) return `must be at least ${(e['min'] as { min: number }).min}.`;
    return 'is invalid.';
  }
}
