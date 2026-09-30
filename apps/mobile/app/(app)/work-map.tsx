import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  demandMapSchema,
  jobCategoryName,
  type AreaDemand,
  type DemandMap,
} from '@workflex/shared';
import { api } from '../../src/api/client';
import { BangladeshMap } from '../../src/components/map/BangladeshMap';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { MoneyScreen, Notice } from '../../src/components/wallet/WalletUi';
import { useErrorMessage } from '../../src/lib/error-message';
import { useLocale, useT } from '../../src/i18n';
import { useTheme } from '../../src/lib/use-theme';
import { font, radius, space } from '../../src/lib/theme';

async function fetchDemandMap(): Promise<DemandMap> {
  const { data } = await api.get('/jobs/demand-map', { timeout: 60_000 });
  return demandMapSchema.parse(data);
}

/**
 * The Work Map.
 *
 * Two questions on one screen: where is work going unfilled, and where are
 * there more people than jobs. Both are counted from this platform's own
 * rows, and the screen says so plainly rather than letting a national-looking
 * map imply it knows the national labour market.
 *
 * The colours are relative to the country's own figure, not absolute. A
 * division with forty postings is not red because forty is a big number; it
 * is red because forty posts stand against fewer workers than the rest of the
 * map manages. That is the only comparison the data can honestly support.
 */
export default function WorkMapScreen() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { c } = useTheme();
  const errorMessage = useErrorMessage();

  const [selected, setSelected] = useState<string | null>(null);

  const map = useQuery({
    queryKey: ['demand-map'],
    queryFn: fetchDemandMap,
    staleTime: 600_000,
  });

  const areas = map.data?.areas ?? [];
  const area = areas.find((one) => one.division === selected) ?? null;

  return (
    <MoneyScreen title={t('workMap.title')} subtitle={t('workMap.subtitle')}>
      {map.error ? <ErrorBanner message={errorMessage(map.error)} tone="onSurface" /> : null}

      {map.isLoading ? (
        <>
          <ActivityIndicator color={c.primary} style={s.loading} />
          <Text style={[s.note, { color: c.textMuted }]}>{t('workMap.working')}</Text>
        </>
      ) : !map.data ? null : (
        <>
          <View style={[s.mapCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <BangladeshMap
              areas={areas}
              selected={selected}
              onSelect={(division) =>
                setSelected((held) => (held === division ? null : division))
              }
            />
          </View>

          <View style={s.legend}>
            <Key tone={c.danger} label={t('workMap.keyShortWorkers')} />
            <Key tone={c.warning} label={t('workMap.keyBalanced')} />
            <Key tone={c.success} label={t('workMap.keyShortWork')} />
          </View>
          <Text style={[s.note, { color: c.textMuted }]}>{t('workMap.tapNote')}</Text>

          {area ? (
            <AreaPanel area={area} onClose={() => setSelected(null)} />
          ) : (
            <Notice tone="info" body={map.data.insight} />
          )}

          {/* The whole point of the feature, in a list: which kind of work,
              where, is going unfilled. */}
          <Text style={[s.heading, { color: c.text }]}>{t('workMap.gaps')}</Text>
          {map.data.gaps.length === 0 ? (
            <Notice tone="info" body={t('workMap.noGaps')} />
          ) : (
            map.data.gaps.map((gap) => (
              <Pressable
                key={`${gap.division}:${gap.category}`}
                onPress={() =>
                  // The jobs screen searches one free-text term across title,
                  // location and district, so the division name is what can
                  // actually be handed to it — the category is named on the
                  // card the reader just tapped.
                  router.push({ pathname: '/(app)/jobs', params: { q: gap.en } })
                }
                accessibilityRole="button"
                style={({ pressed }) => [
                  s.gap,
                  {
                    backgroundColor: pressed ? c.surfaceAlt : c.surface,
                    borderColor: c.border,
                  },
                ]}
              >
                <View style={s.gapTop}>
                  <Text style={[s.gapWhat, { color: c.text }]} numberOfLines={1}>
                    {jobCategoryName(gap.category, locale)}
                  </Text>
                  <Text style={[s.gapWhere, { color: c.textMuted }]} numberOfLines={1}>
                    {locale === 'bn' ? gap.bn : gap.en}
                  </Text>
                </View>
                <Text style={[s.gapWhy, { color: c.text }]}>{gap.why}</Text>
                <Text style={[s.gapLink, { color: c.primary }]}>{t('workMap.seeJobs', { area: locale === 'bn' ? gap.bn : gap.en })}</Text>
              </Pressable>
            ))
          )}

          <Text style={[s.note, { color: c.textMuted }]}>
            {t('workMap.counted', {
              vacancies: map.data.totals.vacancies,
              workers: map.data.totals.workers,
            })}
          </Text>
          {map.data.unplaced.jobs > 0 || map.data.unplaced.workers > 0 ? (
            <Text style={[s.note, { color: c.textMuted }]}>
              {t('workMap.unplaced', {
                jobs: map.data.unplaced.jobs,
                workers: map.data.unplaced.workers,
              })}
            </Text>
          ) : null}
          <Text style={[s.note, { color: c.textMuted }]}>{t('workMap.footnote')}</Text>
        </>
      )}
    </MoneyScreen>
  );
}

function AreaPanel({ area, onClose }: { area: AreaDemand; onClose: () => void }) {
  const t = useT();
  const [locale] = useLocale();
  const { c } = useTheme();

  const tone =
    area.band === 'SHORT_OF_WORKERS'
      ? c.danger
      : area.band === 'SHORT_OF_WORK'
        ? c.success
        : c.warning;

  return (
    <View style={[s.panel, { backgroundColor: c.surface, borderColor: tone }]}>
      <View style={s.panelTop}>
        <Text style={[s.panelName, { color: c.text }]}>
          {locale === 'bn' ? area.bn : area.en}
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
          <Text style={[s.close, { color: c.textMuted }]}>{t('common.close')}</Text>
        </Pressable>
      </View>

      <Text style={[s.panelBand, { color: tone }]}>
        {area.band === 'SHORT_OF_WORKERS'
          ? t('workMap.keyShortWorkers')
          : area.band === 'SHORT_OF_WORK'
            ? t('workMap.keyShortWork')
            : t('workMap.keyBalanced')}
      </Text>

      <View style={s.figures}>
        <Figure label={t('workMap.vacancies')} value={area.vacancies} />
        <Figure label={t('workMap.workers')} value={area.workers} />
        <Figure
          label={t('workMap.balance')}
          text={
            area.quotient === null
              ? t('workMap.noWorkers')
              : t('workMap.times', { n: area.quotient })
          }
        />
      </View>

      <Text style={[s.shares, { color: c.textMuted }]}>
        {t('workMap.shares', { posts: area.shareOfPosts, workers: area.shareOfWorkers })}
      </Text>

      {area.topCategories.length === 0 ? (
        <Text style={[s.panelEmpty, { color: c.textMuted }]}>{t('workMap.noneHere')}</Text>
      ) : (
        area.topCategories.map((row) => (
          <View key={row.category} style={s.row}>
            <View
              style={[
                s.dot,
                {
                  backgroundColor:
                    row.band === 'SHORT_OF_WORKERS'
                      ? c.danger
                      : row.band === 'SHORT_OF_WORK'
                        ? c.success
                        : c.warning,
                },
              ]}
            />
            <Text style={[s.rowName, { color: c.text }]} numberOfLines={1}>
              {jobCategoryName(row.category, locale)}
            </Text>
            <Text style={[s.rowFigures, { color: c.textMuted }]}>
              {row.vacancies} / {row.workers}
            </Text>
          </View>
        ))
      )}
      <Text style={[s.rowKey, { color: c.textMuted }]}>{t('workMap.rowKey')}</Text>
    </View>
  );
}

function Figure({ label, value, text }: { label: string; value?: number; text?: string }) {
  const { c } = useTheme();
  return (
    <View style={s.figure}>
      <Text style={[s.figureValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {text ?? value}
      </Text>
      <Text style={[s.figureLabel, { color: c.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Key({ tone, label }: { tone: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={s.key}>
      <View style={[s.dot, { backgroundColor: tone }]} />
      <Text style={[s.keyText, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { marginTop: space.lg },
  heading: { fontSize: font.md, fontWeight: '800', marginTop: space.lg, marginBottom: space.xs },
  note: { fontSize: font.xs, lineHeight: 17, marginTop: space.xs },

  mapCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.sm,
    marginTop: space.sm,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginTop: space.md,
  },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyText: { fontSize: font.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },

  panel: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
  },
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelName: { fontSize: font.md, fontWeight: '900' },
  close: { fontSize: font.xs, fontWeight: '700' },
  panelBand: { fontSize: font.xs, fontWeight: '800', marginTop: 2 },
  panelEmpty: { fontSize: font.xs, marginTop: space.sm },

  figures: { flexDirection: 'row', gap: space.md, marginTop: space.sm, marginBottom: space.sm },
  figure: { flex: 1 },
  figureValue: { fontSize: font.lg, fontWeight: '900' },
  figureLabel: { fontSize: font.xs - 1, lineHeight: 14 },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 5 },
  rowName: { flex: 1, fontSize: font.xs + 1, fontWeight: '700' },
  rowFigures: { fontSize: font.xs, fontWeight: '700' },
  rowKey: { fontSize: font.xs - 1, marginTop: space.xs },
  shares: { fontSize: font.xs, marginBottom: space.xs },

  gap: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  gapTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  gapWhat: { flex: 1, fontSize: font.sm + 1, fontWeight: '800' },
  gapWhere: { fontSize: font.xs, fontWeight: '700' },
  gapWhy: { fontSize: font.xs + 1, lineHeight: 18, marginTop: space.xs },
  gapLink: { fontSize: font.xs, fontWeight: '800', marginTop: space.xs },
});
