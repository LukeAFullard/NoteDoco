import { DEFAULT_PEN_SETTINGS, engineSettings, resetPenSettings, setPenSettings, usePenSettings } from './penSettings';

describe('pen settings', () => {
  it('turns choices into engine settings', () => {
    const e = engineSettings({ ...DEFAULT_PEN_SETTINGS, fingers: 'never', pressure: 'light', barrel: 'lasso', palmSize: 60 });
    expect(e).toMatchObject({ fingerDraws: false, fingerAlways: false, pressure: true, barrel: 'lasso', palmSize: 60 });
    expect(e.pressureGamma).toBeLessThan(1);
    expect(engineSettings({ ...DEFAULT_PEN_SETTINGS, fingers: 'always', pressure: 'off' })).toMatchObject({ fingerDraws: true, fingerAlways: true, pressure: false });
  });

  it('remembers changes on this device and resets', () => {
    setPenSettings({ hand: 'left', toolbar: 'side' });
    expect(JSON.parse(localStorage.getItem('notedoco:ink.settings')!)).toMatchObject({ hand: 'left', toolbar: 'side' });
    resetPenSettings();
    expect(usePenSettings.getState()).toEqual(DEFAULT_PEN_SETTINGS);
  });
});
