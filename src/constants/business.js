// Business details printed on quotation PDFs (api/quotation-pdf.js) and usable in the app.
//
// ⚠ FILL THESE IN BEFORE LAUNCH. Leave a value as null until you have the real one:
// null fields are simply left off the PDF, so nothing made-up is ever printed.

export const BUSINESS = {
  name: 'Surinder Caterers',
  tagline: null, // e.g. 'Wedding & event catering'
  address: null, // full postal address; use \n for line breaks
  phone: null, // e.g. '+91 98xxx xxxxx'
  email: null,
  website: null,
  gstin: null, // 15-character GSTIN, printed as "GSTIN: …"

  // Shown in a "Payment details" box on the PDF. Leave everything null to hide the box.
  payment: {
    accountName: null,
    bankName: null,
    accountNumber: null,
    ifsc: null,
    branch: null,
    upiId: null,
  },
}
