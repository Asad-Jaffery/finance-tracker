/**
 * Synthetic Amex-like statement for playbook golden ingest.
 *
 * Output: fixtures/synthetic-statement.pdf (gitignored — never commit).
 * Golden: golden/synthetic-statement-2026-08.json
 *
 * Required cases on this statement:
 * - store numbers (CHIPOTLE #1823, CHIPOTLE 0472, FITNESS #123, STORE 123, SHELL OIL 12345678)
 * - UBER vs UBER EATS (do not collapse)
 * - gym (24 HOUR FITNESS → Subscriptions)
 * - coffee (BLUE BOTTLE COFFEE, STARBUCKS → Food + coffee)
 * - AUTOPAY (must be dropped; never in golden)
 * - a merchant refund (CHIPOTLE negative)
 * - two issuers (amex + chase) with mixed descriptors
 * - window 07/12/2026–08/11/2026: closing date 08/11/2026 → book month 2026-08
 *   (ambiguous-enough dates; closing-date rule picks 2026-08 without asking)
 *
 * Run: node --experimental-strip-types fixtures/generate-synthetic-statement.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "synthetic-statement.pdf");

type Line = { date: string; description: string; amount: string; issuer: string };

const LINES: Line[] = [
  { date: "07/15/2026", description: "CHIPOTLE #1823 SF", amount: "12.45", issuer: "amex" },
  { date: "07/18/2026", description: "UBER *TRIP", amount: "18.40", issuer: "amex" },
  { date: "07/20/2026", description: "UBER EATS", amount: "23.17", issuer: "amex" },
  { date: "07/22/2026", description: "24 HOUR FITNESS #123", amount: "49.99", issuer: "amex" },
  { date: "07/25/2026", description: "SQ *BLUE BOTTLE COFFEE", amount: "6.50", issuer: "amex" },
  { date: "07/28/2026", description: "AUTOPAY", amount: "-400.00", issuer: "amex" },
  { date: "08/02/2026", description: "CHIPOTLE 0472 OAKLAND", amount: "14.20", issuer: "amex" },
  { date: "08/03/2026", description: "NETFLIX", amount: "15.99", issuer: "chase" },
  { date: "08/04/2026", description: "SHELL OIL 12345678", amount: "48.90", issuer: "amex" },
  { date: "08/05/2026", description: "AMAZON.COM*AMZN.COM/BILL", amount: "56.99", issuer: "amex" },
  { date: "08/06/2026", description: "CHIPOTLE #1823 SF", amount: "-5.40", issuer: "amex" },
  { date: "08/08/2026", description: "STARBUCKS STORE 123", amount: "5.75", issuer: "amex" },
  { date: "08/10/2026", description: "UNKNOWN MERCHANT XYZ", amount: "9.00", issuer: "amex" },
];

async function main(): Promise<void> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Courier);
  const bold = await doc.embedFont(StandardFonts.CourierBold);
  const black = rgb(0, 0, 0);
  let y = 760;
  const left = 40;

  const line = (text: string, size = 10, f = font): void => {
    page.drawText(text, { x: left, y, size, font: f, color: black });
    y -= 14;
  };

  line("AMERICAN EXPRESS", 14, bold);
  line("Member since 2004");
  line("Account ending 1003");
  line("Issuer: amex");
  y -= 6;
  line("Statement period: 07/12/2026 - 08/11/2026", 11, bold);
  line("Opening date: 07/12/2026");
  line("Closing date: 08/11/2026");
  line("Book month follows closing-date month: 2026-08");
  y -= 8;
  line("TRANSACTIONS", 12, bold);
  line("Date        Description                         Amount    Card");
  line("----------------------------------------------------------------");

  for (const row of LINES) {
    const desc = row.description.padEnd(36, " ");
    const amt = row.amount.padStart(8, " ");
    const issuer = row.issuer.padStart(6, " ");
    line(`${row.date}  ${desc}${amt}  ${issuer}`);
  }

  y -= 10;
  line("CHASE CREDIT CARD (same statement packet)", 11, bold);
  line("Issuer: chase");
  line("NETFLIX on 08/03/2026 is the chase row above.");
  y -= 8;
  line("Payments / AUTOPAY are not purchases. Do not ingest AUTOPAY.");
  line("End of statement.");

  const bytes = await doc.save();
  writeFileSync(OUT, bytes);
  console.log(`wrote ${OUT}`);
}

void main();
