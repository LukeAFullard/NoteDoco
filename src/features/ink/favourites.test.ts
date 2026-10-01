import { addFavourite, DEFAULT_FAVOURITES, favouriteLabel, MAX_FAVOURITES, removeFavourite } from './favourites';

describe('favourite pens', () => {
  it('names pens in words', () => {
    expect(favouriteLabel({ tool: 'fountain', colour: 'red', size: 1 })).toBe('Red fountain pen, medium');
    expect(favouriteLabel({ tool: 'ballpoint', colour: '#123456', size: 0.4 })).toBe('Custom colour ballpoint, extra fine');
  });

  it('adds without duplicates and keeps at most six', () => {
    expect(addFavourite(DEFAULT_FAVOURITES, DEFAULT_FAVOURITES[0]!)).toBe(DEFAULT_FAVOURITES);
    let list = DEFAULT_FAVOURITES;
    for (const size of [0.4, 0.7, 1.6]) list = addFavourite(list, { tool: 'marker', colour: 'green', size });
    expect(list).toHaveLength(MAX_FAVOURITES);
    expect(list[0]).toEqual(DEFAULT_FAVOURITES[1]);
    expect(removeFavourite(list, 0)).toHaveLength(5);
  });
});
