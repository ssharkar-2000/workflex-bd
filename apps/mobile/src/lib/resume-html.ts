import { ACCENT_COLOURS, type ResumeDraft, type ResumeEntry } from './resume-draft';

/**
 * The CV as a printable page.
 *
 * The on-screen preview is React Native views, which cannot be printed or
 * attached to an email — so the document a person actually sends is built
 * here, once, and handed to whichever printer the platform has (a browser's
 * print dialog on the web, the system one on a phone). Keeping it in a single
 * pure function is what stops the printed CV from drifting away from the one
 * they were looking at while they wrote it.
 *
 * Deliberately one column and almost entirely black on white. A CV in
 * Bangladesh is read on a phone, printed on whatever is in the office, and
 * photocopied — a design that depends on a coloured sidebar surviving that
 * journey is a design that loses the text.
 */

export type ResumeLabels = {
  summary: string;
  experience: string;
  education: string;
  projects: string;
  certificates: string;
  skills: string;
  languages: string;
  yourName: string;
};

const TEMPLATE_ACCENTS: Record<ResumeDraft['template'], string> = {
  CLASSIC: '#1A1A2E',
  MODERN: '#3A34A0',
  COMPACT: '#0F6B4F',
};

/** The colour the person chose, or the one their template leads with. */
export function accentFor(draft: ResumeDraft): string {
  return draft.accent === 'AUTO'
    ? TEMPLATE_ACCENTS[draft.template]
    : ACCENT_COLOURS[draft.accent];
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;'
      : ch === '<' ? '&lt;'
        : ch === '>' ? '&gt;'
          : ch === '"' ? '&quot;'
            : '&#39;',
  );
}

function filled(value: string): boolean {
  return value.trim().length > 0;
}

function entryHtml(entry: ResumeEntry): string {
  const dates = [entry.from, entry.to].filter(filled).join(' – ');
  const where = [entry.org, entry.place].filter(filled).join(', ');
  const lines = entry.detail
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return [
    '<div class="entry">',
    '<div class="entry-top">',
    `<span class="entry-title">${esc(entry.title)}</span>`,
    dates ? `<span class="entry-dates">${esc(dates)}</span>` : '',
    '</div>',
    where ? `<div class="entry-org">${esc(where)}</div>` : '',
    lines.length
      ? `<ul>${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>`
      : '',
    '</div>',
  ].join('');
}

function section(title: string, body: string): string {
  return body ? `<section><h2>${esc(title)}</h2>${body}</section>` : '';
}

export function resumeHtml(draft: ResumeDraft, labels: ResumeLabels): string {
  const accent = accentFor(draft);
  const name = filled(draft.fullName) ? draft.fullName : labels.yourName;
  const contact = [draft.phone, draft.email, draft.location, draft.link]
    .filter(filled)
    .join('  ·  ');

  const rows = (entries: ResumeEntry[]) =>
    entries.filter((entry) => filled(entry.title) || filled(entry.org)).map(entryHtml).join('');

  const head =
    draft.template === 'MODERN'
      ? `<header class="band"><h1>${esc(name)}</h1>${
          filled(draft.headline) ? `<div class="headline">${esc(draft.headline)}</div>` : ''
        }</header>`
      : `<header><h1>${esc(name)}</h1>${
          filled(draft.headline) ? `<div class="headline">${esc(draft.headline)}</div>` : ''
        }</header>`;

  const body = [
    head,
    contact ? `<div class="contact">${esc(contact)}</div>` : '',
    section(labels.summary, filled(draft.summary) ? `<p>${esc(draft.summary)}</p>` : ''),
    section(labels.experience, rows(draft.experience)),
    section(labels.projects, rows(draft.projects)),
    section(labels.education, rows(draft.education)),
    section(labels.certificates, rows(draft.certificates)),
    section(
      labels.skills,
      draft.skills.length
        ? `<div class="chips">${draft.skills
            .map((skill) => `<span class="chip">${esc(skill)}</span>`)
            .join('')}</div>`
        : '',
    ),
    section(
      labels.languages,
      draft.languages.length ? `<p>${esc(draft.languages.join(', '))}</p>` : '',
    ),
  ].join('');

  // No webfont link: a print that waits on a network request prints a
  // fallback font or nothing. Every platform this runs on already has a
  // Bangla face, and these are their names.
  return `<!doctype html>
<html lang="${draft.languages.some((l) => /bangla|বাং/i.test(l)) ? 'bn' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #1A1A2E;
    background: #FFFFFF;
    font-family: 'Hind Siliguri', 'Noto Sans Bengali', 'Nirmala UI', system-ui,
      -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  #sheet { max-width: 182mm; margin: 0 auto; }
  h1 { font-size: 21pt; margin: 0; letter-spacing: 0.2px; }
  .headline { font-size: 11pt; font-weight: 600; color: ${accent}; margin-top: 2px; }
  .band { background: ${accent}; color: #FFFFFF; padding: 10mm 8mm; border-radius: 3mm; }
  .band h1, .band .headline { color: #FFFFFF; }
  .contact { font-size: 9pt; color: #4A4A63; margin-top: 4px; }
  section { margin-top: 6mm; }
  h2 {
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: ${accent};
    margin: 0 0 1.5mm;
    padding-bottom: 1mm;
    border-bottom: 1px solid ${accent}59;
  }
  p { margin: 0; }
  .entry { margin-bottom: 3mm; }
  /* Keeps a job title from printing alone at the foot of a page. */
  .entry, section { break-inside: avoid; page-break-inside: avoid; }
  .entry-top { display: flex; justify-content: space-between; gap: 6mm; align-items: baseline; }
  .entry-title { font-weight: 700; }
  .entry-dates { font-size: 9pt; color: #6B6B85; white-space: nowrap; }
  .entry-org { font-size: 9.5pt; color: #4A4A63; }
  ul { margin: 1mm 0 0; padding-left: 4.5mm; }
  li { margin-bottom: 0.6mm; }
  .chips { display: flex; flex-wrap: wrap; gap: 1.5mm; }
  .chip {
    background: #F1EFF7;
    border-radius: 1.5mm;
    padding: 0.8mm 2mm;
    font-size: 9.5pt;
  }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div id="sheet">${body}</div>
<script>
  /* One page if it nearly fits: a CV that spills three lines onto a second
     sheet is worse than one set very slightly smaller. Below 70% it stops —
     past that it is unreadable and the honest answer is two pages. Browsers
     only; a phone's print formatter ignores scripts and paginates normally. */
  (function () {
    var sheet = document.getElementById('sheet');
    var pageMm = 297 - 28;
    function fit() {
      sheet.style.zoom = '';
      var mm = sheet.getBoundingClientRect().height / (96 / 25.4);
      if (mm > pageMm) sheet.style.zoom = String(Math.max(0.7, pageMm / mm));
    }
    window.addEventListener('beforeprint', fit);
    fit();
  })();
</script>
</body>
</html>`;
}
