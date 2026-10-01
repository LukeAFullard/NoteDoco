import { InputRouter, type PointerSample } from './inputRouter';

const ev = (o: Partial<PointerSample>): PointerSample => ({
  pointerId: 1,
  pointerType: 'touch',
  button: 0,
  buttons: 1,
  width: 10,
  height: 10,
  timeStamp: 0,
  ...o,
});

describe('InputRouter', () => {
  it('lets fingers draw until a pen is seen, then fingers navigate', () => {
    const r = new InputRouter();
    expect(r.down(ev({ pointerId: 1 })).role).toEqual({ kind: 'draw', tool: 'primary' });
    r.up(ev({ pointerId: 1, timeStamp: 50 }));
    r.down(ev({ pointerId: 2, pointerType: 'pen', timeStamp: 100 }));
    r.up(ev({ pointerId: 2, pointerType: 'pen', timeStamp: 200 }));
    expect(r.down(ev({ pointerId: 3, timeStamp: 1000 })).role).toEqual({ kind: 'navigate' });
  });

  it('ignores touches while the pen is down and just after it lifts', () => {
    const r = new InputRouter();
    r.down(ev({ pointerId: 9, pointerType: 'pen', timeStamp: 0 }));
    expect(r.down(ev({ pointerId: 1, timeStamp: 10 })).role).toMatchObject({ kind: 'ignore', reason: 'pen-active' });
    r.up(ev({ pointerId: 9, pointerType: 'pen', timeStamp: 100 }));
    expect(r.down(ev({ pointerId: 2, timeStamp: 250 })).role).toMatchObject({ kind: 'ignore', reason: 'pen-recent' });
    expect(r.down(ev({ pointerId: 3, timeStamp: 500 })).role).toEqual({ kind: 'navigate' });
    expect(r.stats.palmsRejected).toBe(2);
  });

  it('treats large contacts as palms', () => {
    const r = new InputRouter();
    expect(r.down(ev({ width: 60, height: 70 })).role).toMatchObject({ kind: 'ignore', reason: 'palm-size' });
  });

  it('ignores touches while the pen hovers', () => {
    const r = new InputRouter();
    r.hover(ev({ pointerType: 'pen', buttons: 0, timeStamp: 1000 }));
    expect(r.down(ev({ timeStamp: 1100 })).role).toMatchObject({ kind: 'ignore' });
  });

  it('retracts a touch stroke that started just before the pen landed (palm first)', () => {
    const r = new InputRouter();
    r.down(ev({ pointerId: 1, timeStamp: 0 }));
    const res = r.down(ev({ pointerId: 7, pointerType: 'pen', timeStamp: 60 }));
    expect(res.retract).toEqual([1]);
    expect(r.stats.retracted).toBe(1);
  });

  it('does not retract an older, deliberate finger stroke', () => {
    const r = new InputRouter();
    r.down(ev({ pointerId: 1, timeStamp: 0 }));
    expect(r.down(ev({ pointerId: 7, pointerType: 'pen', timeStamp: 900 })).retract).toEqual([]);
  });

  it('maps the pen eraser end and barrel button', () => {
    const r = new InputRouter();
    expect(r.down(ev({ pointerType: 'pen', buttons: 32, button: 5 })).role).toEqual({ kind: 'draw', tool: 'eraser' });
    expect(r.down(ev({ pointerId: 2, pointerType: 'pen', buttons: 3, button: 0 })).role).toEqual({ kind: 'draw', tool: 'secondary' });
  });

  it('respects "draw with finger" off', () => {
    const r = new InputRouter({ fingerDraws: false, palmSize: 44, penGraceMs: 300, retractWindowMs: 120 });
    expect(r.down(ev({})).role).toEqual({ kind: 'navigate' });
  });

  it('lets the mouse draw with the left button and pan with the middle', () => {
    const r = new InputRouter();
    expect(r.down(ev({ pointerType: 'mouse', button: 0 })).role).toMatchObject({ kind: 'draw' });
    expect(r.down(ev({ pointerType: 'mouse', button: 1, buttons: 4 })).role).toEqual({ kind: 'navigate' });
  });
});
