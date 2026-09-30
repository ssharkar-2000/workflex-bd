import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { ShiftCalendar } from '../../../src/components/shifts/ShiftCalendar';
import { MoneyScreen } from '../../../src/components/wallet/WalletUi';
import { useT } from '../../../src/i18n';

/**
 * The calendar on a page of its own.
 *
 * My Shifts now shows this calendar inline, so nothing in the app links
 * here any more. The route stays because a link somebody already has should
 * not break, and because it costs one screen of chrome around a component
 * that lives somewhere else — there is no second copy of the calendar to
 * fall out of step with the first.
 */
export default function CalendarScreen() {
  const t = useT();
  const client = useQueryClient();
  // The query belongs to the component, so pull-to-refresh asks by key
  // rather than reaching inside it.
  const fetching = useIsFetching({ queryKey: ['calendar'] }) > 0;

  return (
    <MoneyScreen
      title={t('calendar.title')}
      refreshing={fetching}
      onRefresh={() => void client.invalidateQueries({ queryKey: ['calendar'] })}
    >
      <ShiftCalendar />
    </MoneyScreen>
  );
}
