import { useState } from 'react';
import { Bell, BellOff, CalendarPlus } from 'lucide-react';
import { Button } from '@/design/Button';
import { askPermission, notificationPermission, type Permission } from './notify';
import { exportCalendar } from './exportCalendar';

const STATUS: Record<Permission, string> = {
  granted: 'Notifications are on.',
  denied: 'Notifications are blocked for this site. You can allow them in your browser’s site settings.',
  default: 'Notifications are off, so reminders show inside NoteDoco only.',
  unsupported: 'This browser can’t show notifications, so reminders show inside NoteDoco only.',
};

/** Settings → Dates & reminders (TIME-13, TIME-14), with honest wording about the limits. */
export function RemindersSettings() {
  const [permission, setPermission] = useState<Permission>(notificationPermission);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        NoteDoco reminds you while it’s open or in the background. Web apps can’t wake themselves up at a set time, so reminders due while it’s closed show
        up as “While you were away” next time you open it. For alerts you can’t miss, add important items to your calendar.
      </p>
      <p className="flex items-center gap-2">
        {permission === 'granted' ? <Bell size={15} className="text-success" aria-hidden /> : <BellOff size={15} className="text-muted" aria-hidden />}
        {STATUS[permission]}
      </p>
      <div className="flex flex-wrap gap-2">
        {permission === 'default' && (
          <Button size="sm" variant="primary" onPress={async () => setPermission(await askPermission())}>
            <Bell size={14} aria-hidden /> Turn on notifications
          </Button>
        )}
        <Button size="sm" onPress={() => void exportCalendar()}>
          <CalendarPlus size={14} aria-hidden /> Add everything to my calendar (.ics)
        </Button>
      </div>
    </div>
  );
}
