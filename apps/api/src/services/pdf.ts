import type { Browser } from 'playwright-core';

/** HTML → PDF with headless Chromium (one shared browser, a page per document). */
export class PdfRenderer {
  private browser?: Promise<Browser>;
  constructor(private readonly executablePath: string) {}

  private launch(): Promise<Browser> {
    this.browser ??= import('playwright-core').then(({ chromium }) =>
      // Empty path = the browser bundled with playwright-core (Docker image mcr.microsoft.com/playwright).
      chromium.launch({ ...(this.executablePath ? { executablePath: this.executablePath } : {}), args: ['--disable-gpu', '--no-sandbox'] }),
    );
    return this.browser;
  }

  async render(html: string): Promise<Buffer> {
    const b = await this.launch();
    const page = await b.newPage();
    try {
      // No network: everything (images, SVG) is inlined.
      await page.route('**/*', (r) => (r.request().url().startsWith('data:') ? r.continue() : r.abort()));
      await page.setContent(html, { waitUntil: 'load' });
      return await page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) await (await this.browser).close();
    this.browser = undefined;
  }
}
