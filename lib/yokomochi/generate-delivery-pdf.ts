import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type DeliveryPdfTrip = {
  tripCode: string;
  tripNo: number;
  pallets: number;
  boxes: number;
  status: string;
  driverName: string;
  driverPhone: string | null;
  plateNumber: string | null;
  pickupLocation: string;
  destination: string;
  taskStatus: string;
  arrivedFactoryAt: Date | string | null;
  loadedAt: Date | string | null;
  startedAt: Date | string | null;
  arrivedWarehouseAt: Date | string | null;
  completedAt: Date | string | null;
};

export type DeliveryPdfData = {
  orderNo: string;
  status: string;
  productName: string;
  cargoType: string;
  factoryName: string;
  warehouseName: string;
  requestedPallets: number;
  requestedBoxes: number;
  requestedDate: string;
  completedAt: string | null;
  deliveryNo: string | null;
  approvedBy: string | null;
  verificationStatus: string | null;
  trips: DeliveryPdfTrip[];
  labels: {
    title: string;
    order: string;
    status: string;
    product: string;
    factory: string;
    warehouse: string;
    requested: string;
    completed: string;
    deliveryForm: string;
    approvedBy: string;
    trip: string;
    driver: string;
    truck: string;
    route: string;
    timeline: string;
    atFactory: string;
    loaded: string;
    inTransit: string;
    atWarehouse: string;
    done: string;
  };
};

const MARGIN = 48;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

let cachedFontBytes: ArrayBuffer | null = null;

async function loadJapaneseFontBytes(): Promise<ArrayBuffer> {
  if (cachedFontBytes) return cachedFontBytes;
  const response = await fetch('/fonts/NotoSansJP-Regular.otf');
  if (!response.ok) {
    throw new Error('Failed to load Japanese font for PDF');
  }
  cachedFontBytes = await response.arrayBuffer();
  return cachedFontBytes;
}

function fmtDate(value: Date | string | null | undefined, locale: string): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale);
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [''];

  const lines: string[] = [];
  let current = '';

  for (const char of text) {
    const next = current + char;
    const width = font.widthOfTextAtSize(next, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

class PdfWriter {
  private pdfDoc: PDFDocument;
  private page: PDFPage;
  private font: PDFFont;
  private y: number;

  constructor(pdfDoc: PDFDocument, page: PDFPage, font: PDFFont) {
    this.pdfDoc = pdfDoc;
    this.page = page;
    this.font = font;
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  drawTitle(text: string) {
    const size = 16;
    this.ensureSpace(size + 8);
    this.page.drawText(text, {
      x: MARGIN,
      y: this.y - size,
      size,
      font: this.font,
      color: rgb(0.1, 0.1, 0.1),
    });
    this.y -= size + 14;
  }

  drawSectionTitle(text: string) {
    const size = 12;
    this.ensureSpace(size + 10);
    this.page.drawText(text, {
      x: MARGIN,
      y: this.y - size,
      size,
      font: this.font,
      color: rgb(0.1, 0.1, 0.1),
    });
    this.y -= size + 10;
  }

  drawLabelValue(label: string, value: string, labelWidth = 110, fontSize = 10) {
    const lineHeight = fontSize + 4;
    const valueWidth = CONTENT_WIDTH - labelWidth;
    const valueLines = wrapText(value, this.font, fontSize, valueWidth);
    const blockHeight = Math.max(lineHeight, valueLines.length * lineHeight);
    this.ensureSpace(blockHeight + 4);

    this.page.drawText(`${label}:`, {
      x: MARGIN,
      y: this.y - fontSize,
      size: fontSize,
      font: this.font,
      color: rgb(0.2, 0.2, 0.2),
    });

    valueLines.forEach((line, index) => {
      this.page.drawText(line, {
        x: MARGIN + labelWidth,
        y: this.y - fontSize - index * lineHeight,
        size: fontSize,
        font: this.font,
        color: rgb(0.15, 0.15, 0.15),
      });
    });

    this.y -= blockHeight + 6;
  }

  drawDivider() {
    this.ensureSpace(12);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y - 4 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    this.y -= 12;
  }

  skip(lines = 1) {
    this.y -= lines * 8;
  }
}

export async function downloadDeliveryHistoryPdf(data: DeliveryPdfData, locale: string) {
  const fontBytes = await loadJapaneseFontBytes();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const writer = new PdfWriter(pdfDoc, page, font);

  writer.drawTitle(data.labels.title);

  const rows: [string, string][] = [
    [data.labels.order, data.orderNo],
    [data.labels.status, data.status],
    [data.labels.product, `${data.productName} (${data.cargoType})`],
    [data.labels.factory, data.factoryName],
    [data.labels.warehouse, data.warehouseName],
    [
      data.labels.requested,
      `${data.requestedPallets}P / ${data.requestedBoxes} boxes — ${data.requestedDate}`,
    ],
  ];

  if (data.completedAt) {
    rows.push([data.labels.completed, data.completedAt]);
  }
  if (data.deliveryNo) {
    rows.push([data.labels.deliveryForm, data.deliveryNo]);
  }
  if (data.approvedBy) {
    rows.push([data.labels.approvedBy, data.approvedBy]);
  }

  for (const [label, value] of rows) {
    writer.drawLabelValue(label, value);
  }

  writer.skip(1);
  writer.drawSectionTitle(data.labels.trip);

  for (const trip of data.trips) {
    writer.drawSectionTitle(`${trip.tripCode} (#${trip.tripNo})`);

    const tripRows: [string, string][] = [
      [data.labels.driver, `${trip.driverName}${trip.driverPhone ? ` (${trip.driverPhone})` : ''}`],
      [data.labels.truck, trip.plateNumber ?? '—'],
      [data.labels.route, `${trip.pickupLocation} → ${trip.destination}`],
      ['P/B', `${trip.pallets}P / ${trip.boxes} boxes`],
      [data.labels.status, trip.taskStatus],
      [
        data.labels.timeline,
        [
          `${data.labels.atFactory}: ${fmtDate(trip.arrivedFactoryAt, locale)}`,
          `${data.labels.loaded}: ${fmtDate(trip.loadedAt, locale)}`,
          `${data.labels.inTransit}: ${fmtDate(trip.startedAt, locale)}`,
          `${data.labels.atWarehouse}: ${fmtDate(trip.arrivedWarehouseAt, locale)}`,
          `${data.labels.done}: ${fmtDate(trip.completedAt, locale)}`,
        ].join(' | '),
      ],
    ];

    for (const [label, value] of tripRows) {
      writer.drawLabelValue(label, value, 90, 9);
    }

    writer.drawDivider();
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([Uint8Array.from(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `delivery-${data.orderNo}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
