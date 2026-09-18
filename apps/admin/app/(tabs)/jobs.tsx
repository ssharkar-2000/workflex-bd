import { ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Screen } from '../../src/components/ui';
import { colors, font, space } from '../../src/lib/theme';

/**
 * Placeholder with an honest explanation rather than a mocked-up list.
 *
 * Job management is roughly thirty screens in the design pack and needs a
 * Job/Application/Shift model that does not exist in the schema yet. Showing
 * invented listings here would make the portal look finished and leave
 * whoever picks this up unsure which parts were real.
 */
export default function JobsScreen() {
  return (
    <Screen title="Jobs" subtitle="Not yet connected">
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <Text style={styles.title}>Job management is next</Text>
          <Text style={styles.body2}>
            The design covers job review, approvals, featured listings,
            rejections, analytics and posting — around thirty screens. All of
            it needs Job, Application and Shift tables, which the database
            does not have yet.
          </Text>
          <Text style={styles.body2}>
            Rather than show placeholder listings, this screen stays empty
            until those models and endpoints exist.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg },
  title: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: space.sm,
  },
  body2: {
    fontSize: font.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: space.sm,
  },
});
