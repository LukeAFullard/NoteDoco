import { clearSelection, selectRange, toggleSelected, useSelection } from './selection';

beforeEach(clearSelection);

it('toggles and range-selects in display order', () => {
  toggleSelected('b');
  selectRange('d', ['a', 'b', 'c', 'd', 'e']);
  expect([...useSelection.getState().ids].sort()).toEqual(['b', 'c', 'd']);
  toggleSelected('c');
  expect(useSelection.getState().ids.has('c')).toBe(false);
});
