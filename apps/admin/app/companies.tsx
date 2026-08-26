import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchCompanies } from '../src/api/admin';
import { SectionScreen } from '../src/components/SectionScreen';
import { Badge, Card } from '../src/components/ui';
import { colors, font, radius, space } from '../src/lib/theme';

export default function CompaniesScreen() {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['admin-companies', search],
    queryFn: () => fetchCompanies(search.trim() || undefined),
  });

  return (
    <SectionScreen
      title="Company Management"
      subtitle={query.data ? `${query.data.total} registered` : undefined}
      query={query}
    >
      {(data) => (
        <>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search company name"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
          />

          {data.rows.length === 0 ? (
            <Card>
              <Text style={styles.muted}>
                No companies yet. A company record is created when an employer
                completes registration as a company account.
              </Text>
            </Card>
          ) : (
            data.rows.map((c) => (
              <Card key={c.id}>
                <View style={styles.head}>
                  <View style={styles.grow}>
                    <Text style={styles.name}>{c.name}</Text>
                    <Text style={styles.meta}>
                      {c.ownerName} · {c.ownerPhone}
                    </Text>
                  </View>
                  <Badge
                    text={c.verified ? 'Verified' : 'Unverified'}
                    tone={c.verified ? 'success' : 'neutral'}
                  />
                </View>

                <View style={styles.facts}>
                  <Fact label="Reg. no" value={c.registrationNumber} />
                  <Fact label="TIN" value={c.tin} />
                  <Fact label="Trade licence" value={c.tradeLicenseNo} />
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </SectionScreen>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, !value && styles.factEmpty]}>
        {value ?? 'not given'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: font.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  name: { fontSize: font.md, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  facts: { marginTop: space.md, gap: 6 },
  fact: { flexDirection: 'row', justifyContent: 'space-between' },
  factLabel: { fontSize: font.xs, color: colors.textMuted },
  factValue: { fontSize: font.xs, fontWeight: '700', color: colors.text },
  factEmpty: { fontStyle: 'italic', fontWeight: '400', color: colors.textFaint },
  muted: { color: colors.textMuted, fontSize: font.sm, lineHeight: 19 },
});
