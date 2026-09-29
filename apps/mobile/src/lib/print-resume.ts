import * as Print from 'expo-print';

/**
 * Hand the finished CV to the phone's own print sheet.
 *
 * That sheet is also where "Save to Files", "Save as PDF" and AirDrop live on
 * iOS and Android, so one call covers printing it, keeping it and sending it
 * — which is what people actually do with a CV. The web build resolves
 * print-resume.web.ts instead; nothing else in the app knows the difference.
 */
export async function printResume(html: string, _title: string): Promise<void> {
  await Print.printAsync({ html });
}
