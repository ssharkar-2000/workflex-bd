/**
 * Printing on the web, where "Download PDF" means the browser's own dialog
 * with "Save as PDF" as its destination.
 *
 * A hidden iframe rather than window.open: a popup blocker eats the new
 * window silently, and the person is left pressing a button that does
 * nothing. An iframe is never blocked, and printing it prints only the CV —
 * the app's own page is not in the document at all, so there is no print
 * stylesheet to fight.
 *
 * The document's title is what the browser offers as the filename, which is
 * why the CV is built with the person's name in its <title>.
 */
export async function printResume(html: string, title: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error('print frame unavailable');
  }

  doc.open();
  doc.write(html);
  doc.close();
  doc.title = title;

  await new Promise<void>((resolve) => {
    // Give the frame a tick to lay the page out; printing an empty document
    // is the classic way this goes wrong.
    const go = () => {
      try {
        win.focus();
        win.print();
      } finally {
        resolve();
      }
    };
    if (doc.readyState === 'complete') setTimeout(go, 60);
    else frame.onload = () => setTimeout(go, 60);
  });

  // Chrome's print dialog is modal to the tab, so by here the person has
  // either saved or cancelled; either way the frame has done its job. The
  // delay covers Safari, which returns from print() before it has finished.
  setTimeout(() => frame.remove(), 1000);
}
