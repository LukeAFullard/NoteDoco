import { formatBytes, needsHomeScreenInstall } from './durability';

const nav = (userAgent: string, maxTouchPoints = 5, standalone?: boolean) =>
  ({ userAgent, maxTouchPoints, standalone }) as unknown as Navigator;

const IPAD_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1';
const MAC_SAFARI = IPAD_SAFARI;

describe('needsHomeScreenInstall', () => {
  it('flags iPad Safari (which reports itself as a Mac with touch)', () => {
    expect(needsHomeScreenInstall(nav(IPAD_SAFARI, 5), false)).toBe(true);
  });
  it('does not flag an installed Home Screen app', () => {
    expect(needsHomeScreenInstall(nav(IPAD_SAFARI, 5, true), false)).toBe(false);
    expect(needsHomeScreenInstall(nav(IPAD_SAFARI, 5), true)).toBe(false);
  });
  it('flags other iOS browsers too (all use WebKit storage rules)', () => {
    expect(needsHomeScreenInstall(nav(IPHONE_CHROME, 5), false)).toBe(true);
  });
  it('does not flag desktop Safari', () => {
    expect(needsHomeScreenInstall(nav(MAC_SAFARI, 0), false)).toBe(false);
  });
});

it('formats byte counts', () => {
  expect(formatBytes(null)).toBe('–');
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
});
