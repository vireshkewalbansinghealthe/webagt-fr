/**
 * Generates a professional HTML invoice and returns it as a base64-encoded
 * string suitable for attaching to emails via Resend.
 *
 * We use HTML rather than a binary PDF library because Cloudflare Workers
 * have strict bundle-size / runtime limits. HTML renders perfectly as an
 * email attachment that any browser can open and print-to-PDF.
 */

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  shopName: string;
  date: string;
  customerName?: string;
  customerEmail?: string;
  billingAddress?: string;
  shippingAddress?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  shippingAmount: number;
  total: number;
  currency: string;
}

function fmt(amount: number, currency: string): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : `${currency} `;
  return `${sym}${amount.toFixed(2)}`;
}

function parseAddress(json: string | null | undefined): string {
  if (!json) return "";
  try {
    const a = JSON.parse(json);
    const parts = [a.name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean);
    return parts.join("<br/>");
  } catch {
    return "";
  }
}

export function buildInvoiceHtml(data: InvoiceData): string {
  const billingHtml = parseAddress(data.billingAddress);
  const shippingHtml = parseAddress(data.shippingAddress);

  const itemRows = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${item.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:right;">${fmt(item.unitPrice, data.currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:right;">${item.taxRate != null ? `${item.taxRate}%` : `${data.taxRate}%`}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:right;font-weight:600;">${fmt(item.unitPrice * item.quantity, data.currency)}</td>
    </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    @media print { body { margin: 0; } }
    * { box-sizing: border-box; }
  </style>
</head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;padding:40px 32px;">

    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:40px;">
      <tr>
        <td>
          <h1 style="margin:0 0 4px;font-size:28px;font-weight:800;color:#111827;letter-spacing:-0.5px;">${data.shopName}</h1>
          <p style="margin:0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Invoice</p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Invoice No.</p>
          <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#111827;font-family:monospace;">${data.invoiceNumber}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Date</p>
          <p style="margin:0;font-size:14px;color:#111827;">${data.date}</p>
        </td>
      </tr>
    </table>

    <!-- Addresses -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        ${billingHtml ? `<td style="vertical-align:top;width:50%;padding-right:16px;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Bill to</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${billingHtml}</p>
          ${data.customerEmail ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${data.customerEmail}</p>` : ""}
        </td>` : ""}
        ${shippingHtml ? `<td style="vertical-align:top;width:50%;padding-left:16px;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Ship to</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${shippingHtml}</p>
        </td>` : ""}
      </tr>
    </table>

    <!-- Order ref -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:12px 16px;">
          <span style="font-size:13px;color:#6b7280;">Order:</span>
          <span style="font-size:14px;font-weight:600;color:#111827;margin-left:8px;font-family:monospace;">${data.orderNumber}</span>
        </td>
      </tr>
    </table>

    <!-- Line items -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;border-bottom:1px solid #e5e7eb;">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;border-bottom:1px solid #e5e7eb;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;border-bottom:1px solid #e5e7eb;">Unit price</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;border-bottom:1px solid #e5e7eb;">Tax</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;border-bottom:1px solid #e5e7eb;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:40px;">
      <tr>
        <td style="width:55%;"></td>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#6b7280;">Subtotal</td>
              <td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;">${fmt(data.subtotal, data.currency)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#6b7280;">Tax (${data.taxRate}%)</td>
              <td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;">${fmt(data.taxAmount, data.currency)}</td>
            </tr>
            ${data.shippingAmount > 0 ? `<tr>
              <td style="padding:8px 0;font-size:14px;color:#6b7280;">Shipping</td>
              <td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;">${fmt(data.shippingAmount, data.currency)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:12px 0;font-size:18px;font-weight:800;color:#111827;border-top:2px solid #111827;">Total</td>
              <td style="padding:12px 0;font-size:18px;font-weight:800;color:#111827;text-align:right;border-top:2px solid #111827;">${fmt(data.total, data.currency)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;padding-top:24px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
        This invoice was generated by <strong style="color:#6b7280;">${data.shopName}</strong> via WebAGT.<br/>
        &copy; ${new Date().getFullYear()} ${data.shopName}. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>`;
}

export function buildInvoiceNumber(orderNumber: string): string {
  const year = new Date().getFullYear();
  const seq = orderNumber.replace(/^ORD-/i, "");
  return `INV-${year}-${seq}`;
}
