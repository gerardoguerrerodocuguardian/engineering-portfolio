import { campaign } from '../testing';
import { CampaignActions as A } from './campaign.actions';
import { campaignsFeature, initialState } from './campaign.reducer';

const reduce = campaignsFeature.reducer;

describe('campaigns reducer', () => {
  it('sets loading and resets page when the filter changes', () => {
    const s = reduce({ ...initialState, page: 3 }, A.statusFilterChanged({ status: 'PAUSED' }));
    expect(s).toMatchObject({ status: 'PAUSED', page: 1, loading: true });
  });

  it('replaces the entities with the loaded page', () => {
    const before = reduce(initialState, A.loadSuccess({ result: { items: [campaign({ id: 'a' })], page: 1, pageSize: 10, total: 1 } }));
    const after = reduce(before, A.loadSuccess({ result: { items: [campaign({ id: 'b' })], page: 2, pageSize: 10, total: 11 } }));
    expect(after.ids).toEqual(['b']);
    expect(after).toMatchObject({ page: 2, total: 11, loading: false });
  });

  it('adds, updates and removes campaigns', () => {
    let s = reduce(initialState, A.createSuccess({ campaign: campaign({ id: 'x' }) }));
    expect(s.ids).toEqual(['x']);
    expect(s.total).toBe(1);
    s = reduce(s, A.updateSuccess({ campaign: campaign({ id: 'x', name: 'Renamed' }) }));
    expect(s.entities['x']?.name).toBe('Renamed');
    s = reduce(s, A.deleteSuccess({ id: 'x' }));
    expect(s.ids).toEqual([]);
    expect(s.total).toBe(0);
  });

  it('stores errors and clears them on dismissal', () => {
    const failed = reduce({ ...initialState, saving: true }, A.saveFailure({ error: 'boom' }));
    expect(failed).toMatchObject({ error: 'boom', saving: false });
    expect(reduce(failed, A.errorDismissed()).error).toBeNull();
  });
});
