import { campaign } from '../testing';
import { initialState, adapter } from './campaign.reducer';
import { selectListVm, selectPageCount, selectQuery } from './campaign.selectors';

const root = (over = {}) => ({
  campaigns: adapter.setAll([campaign({ id: 'a' }), campaign({ id: 'b' })], { ...initialState, total: 25, pageSize: 10, ...over }),
});

describe('campaign selectors', () => {
  it('computes the page count', () => {
    expect(selectPageCount(root())).toBe(3);
    expect(selectPageCount(root({ total: 0 }))).toBe(1);
  });

  it('exposes the server query', () => {
    expect(selectQuery(root({ page: 2, status: 'DRAFT' }))).toEqual({ page: 2, pageSize: 10, status: 'DRAFT' });
  });

  it('builds the list view model with pagination flags', () => {
    const vm = selectListVm(root({ page: 3 }));
    expect(vm.campaigns.map((c) => c.id)).toEqual(['a', 'b']);
    expect(vm).toMatchObject({ hasPrev: true, hasNext: false, pageCount: 3 });
  });
});
