import { parseQuery } from './query';

it('parses free text and filters', () => {
  expect(parseQuery('launch plan #Work kind:sticky colour:coral in:"launch plan" is:open')).toEqual({
    text: 'launch plan',
    tags: ['work'],
    kinds: ['sticky'],
    colours: ['coral'],
    groups: ['launch plan'],
    pinned: false,
    open: true,
    done: false,
  });
});

it('leaves unknown filters as text', () => {
  expect(parseQuery('kind:spaceship hello').text).toBe('kind:spaceship hello');
});
