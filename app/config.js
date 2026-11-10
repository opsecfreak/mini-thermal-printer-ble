// App configuration: name, default header/footer, and built-in presets.
// Edit this file to brand the app for your shop. Users can also change the header
// in "Shop settings" and save their own presets in the browser.

const R = (desc, qty = 1, price = 0) => ({ desc, qty, price });

export default {
  appName: 'Mini Thermal Printer',
  storageKey: 'mini-thermal-printer-v1',
  logPrefix: 'session',
  logEndpoint: '/api/log', // the bundled serve.mjs saves logs to ./logs/; set to '' to disable
  brand: {
    shopName: 'Your Shop Name',
    tagline: '',
    footer: 'Thank you!',
    currency: '$',
  },
  presets: [
    // Receipts
    { group: 'Receipts', name: 'Blank receipt', doc: { type: 'receipt', title: 'RECEIPT', items: [R('')], taxPct: 0, payment: '', body: '', showFooter: true } },
    { group: 'Receipts', name: 'Sale', doc: { type: 'receipt', title: 'SALE', items: [R('Item 1'), R('Item 2')], taxPct: 0, payment: '', body: '', showFooter: true } },
    { group: 'Receipts', name: 'Service / invoice', doc: { type: 'receipt', title: 'SERVICE', items: [R('Parts'), R('Labor')], taxPct: 0, payment: '', body: 'Warranty: __ days.', showFooter: true } },
    { group: 'Receipts', name: 'Estimate', doc: { type: 'receipt', title: 'ESTIMATE', items: [R('Parts'), R('Labor')], taxPct: 0, payment: '', body: '**This is an estimate, not a bill.**\nValid for __ days.', showFooter: true } },
    { group: 'Receipts', name: 'Deposit', doc: { type: 'receipt', title: 'DEPOSIT RECEIVED', items: [R('Deposit')], taxPct: 0, payment: '', body: 'Balance due at pickup.', showFooter: true } },

    // Notes
    { group: 'Notes', name: 'Thank you', doc: { type: 'note', title: 'THANK YOU!', body: '> We appreciate your business.', showFooter: true } },
    { group: 'Notes', name: 'Ready for pickup', doc: { type: 'note', title: 'READY FOR PICKUP', body: 'Your order is ready.\nPlease bring this slip when you pick it up.', showFooter: true } },
    { group: 'Notes', name: 'Waiting on parts', doc: { type: 'note', title: 'WAITING ON PARTS', body: 'Expected arrival: ____________\nWe will contact you when it is ready.', showFooter: true } },
    { group: 'Notes', name: 'Message', doc: { type: 'note', title: 'NOTE', body: 'To: ____________\nFrom: ____________\n\n', showFooter: false } },

    // Warnings
    { group: 'Warnings', name: 'Caution', doc: { type: 'warning', title: 'CAUTION', body: 'Describe the hazard here.' } },
    { group: 'Warnings', name: 'Out of order', doc: { type: 'warning', title: 'OUT OF ORDER', body: '> Do not use.\n> Reported: ____________' } },
    { group: 'Warnings', name: 'Do not touch', doc: { type: 'warning', title: 'DO NOT TOUCH', body: '> Work in progress.' } },
    { group: 'Warnings', name: 'Lithium battery safety', doc: { type: 'warning', title: 'LITHIUM BATTERY', body: '- Never charge unattended\n- Do not use swollen or damaged batteries\n- Do not puncture, crush or short\n- Recycle at a battery drop-off' } },
    { group: 'Warnings', name: 'Fragile', doc: { type: 'warning', title: 'FRAGILE', body: '> Handle with care' } },

    // Checklists
    { group: 'Checklists', name: 'To-do', doc: { type: 'checklist', title: 'TO DO', body: '\n\n\n' } },
    { group: 'Checklists', name: 'Shopping list', doc: { type: 'checklist', title: 'SHOPPING LIST', body: 'Milk\nBread\nEggs' } },
    { group: 'Checklists', name: 'Opening checklist', doc: { type: 'checklist', title: 'OPENING', body: 'Lights and sign on\nRegister counted\nPrinter paper loaded\nDoor unlocked' } },
    { group: 'Checklists', name: 'Packing checklist', doc: { type: 'checklist', title: 'PACKING', body: 'Items checked\nPacking slip included\nBox sealed\nLabel attached' } },

    // Tags & labels
    { group: 'Tags & labels', name: 'Order ticket', doc: { type: 'tag', title: 'ORDER TICKET', body: 'Ticket #: \nName: \nPhone: \nItem: \nNotes: \nDue: ', showFooter: true } },
    { group: 'Tags & labels', name: 'Shelf / bin label', doc: { type: 'tag', title: 'BIN A-1', body: 'Contents: \nQty: ' } },
    { group: 'Tags & labels', name: 'Package label', doc: { type: 'tag', title: 'PACKAGE', body: 'To: \nFrom: \nContents: ' } },
    { group: 'Tags & labels', name: 'Guest Wi-Fi card', doc: { type: 'tag', title: 'GUEST WI-FI', body: 'Network: \nPassword: ' } },
  ],
};
