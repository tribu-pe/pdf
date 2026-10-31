import { expect, test } from 'vitest';
import { blocks, pdf, type Template } from '../src/index';
import { records } from './support/records';

// The custom template from the README, kept compiling and drawing.
test('the README template works', async () => {
  const mine: Template = (data, { theme }) => ({
    pageSize: 'A5',
    defaultStyle: { font: theme.font, fontSize: 8 },
    content: [
      blocks.heading(data, theme, { alignment: 'left' }),
      { columns: [blocks.issuer(data, theme), blocks.customer(data, theme)], columnGap: 24 },
      blocks.items(data, theme),
      blocks.totals(data, theme),
      blocks.amountInWords(data, theme),
      blocks.payment(data, theme),
      blocks.detraccion(data, theme),
      blocks.qr(data),
      blocks.legends(data, theme),
    ].filter((block) => block !== null),
  });
  const { 'invoice-detraccion': record } = await records();
  if (record === undefined) throw new Error('no record');
  const bytes = await pdf(record, { template: mine });
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
});
