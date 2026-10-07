import * as store from './store.js';
import { newBusiness, newClient, newDocument, newLineItem, newSection } from './models.js';
import { addDays, toISODate } from './format.js';
import { formatNumber } from './numbering.js';

const TAG = { demo: true };

export function hasDemoData() {
  return store.state.businesses.some((b) => b.demo) || store.state.clients.some((c) => c.demo) || store.state.documents.some((d) => d.demo);
}

export async function loadDemoData() {
  if (hasDemoData()) return null;
  const hadBusiness = store.state.businesses.length > 0;
  const businesses = [
    newBusiness({ ...TAG, name: 'Northwind Carpentry', ownerName: 'Sam Carter', email: 'sam@northwindcarpentry.com', phone: '+1 555 010 2233', address: '42 Harbor Street\nPortland, ME 04101', website: 'northwindcarpentry.com', taxNumber: 'EIN 12-3456789', paymentInstructions: 'Bank transfer: First Harbor Bank\nAccount 1234567890 · Routing 011000015\nOr pay by check to Northwind Carpentry', defaultNotes: 'Thank you for your business!', isDefault: !hadBusiness }),
    newBusiness({ ...TAG, name: 'Pixel & Co. Design', ownerName: 'Ava Lind', email: 'hello@pixelandco.design', phone: '+1 555 010 7788', address: '18 Mission Lane, Suite 4\nAustin, TX 78701', website: 'pixelandco.design', paymentInstructions: 'PayPal: pay@pixelandco.design', defaultNotes: 'Payment is due within the stated terms. Late payments may incur a 2% monthly fee.', isDefault: false })
  ];
  const clients = [
    newClient({ ...TAG, name: 'Maria Gonzalez', company: 'Gonzalez Family Home', email: 'maria.g@example.com', phone: '+1 555 234 1100', address: '7 Elm Court\nPortland, ME 04102' }),
    newClient({ ...TAG, name: 'Daniel Okafor', company: 'Okafor Dental Group', email: 'daniel@okafordental.com', phone: '+1 555 234 3300', address: '900 Congress Ave\nAustin, TX 78701' }),
    newClient({ ...TAG, name: 'Hannah Weiss', company: '', email: 'hannah.weiss@example.com', phone: '+1 555 234 4400', address: '12 Birch Road\nFalmouth, ME 04105' }),
    newClient({ ...TAG, name: 'Liam Chen', company: 'Bluebird Café', email: 'liam@bluebirdcafe.com', phone: '+1 555 234 5500', address: '301 Main Street\nSouth Portland, ME 04106' }),
    newClient({ ...TAG, name: 'Priya Natarajan', company: 'Natarajan Consulting', email: 'priya@natarajan.co', phone: '', address: '55 Lakeview Drive\nAustin, TX 78703' }),
    newClient({ ...TAG, name: 'Tom Becker', company: 'Becker Properties', email: 'tom@beckerproperties.com', phone: '+1 555 234 7700', address: '2 Pier Road\nPortland, ME 04101' })
  ];
  await store.saveMany('businesses', businesses);
  await store.saveMany('clients', clients);
  const documents = demoDocuments(businesses, clients);
  await store.saveMany('documents', documents);
  await store.saveMany('businesses', businesses);
  return { businesses, clients, documents };
}

export async function removeDemoData() {
  for (const name of ['documents', 'clients', 'businesses']) {
    const ids = store.state[name].filter((r) => r.demo).map((r) => r.id);
    for (const id of ids) await store.remove(name, id);
  }
  if (store.state.businesses.length && !store.state.businesses.some((b) => b.isDefault)) {
    await store.save('businesses', { ...store.state.businesses[0], isDefault: true });
  }
}

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return toISODate(d); }

function demoDocuments(biz, cl) {
  const s = store.state.settings;
  const [carpentry, pixel] = biz;
  const [maria, daniel, hannah, liam, priya, tom] = cl;
  let inv = carpentry.nextInvoiceNumber, est = carpentry.nextEstimateNumber, invP = pixel.nextInvoiceNumber, estP = pixel.nextEstimateNumber;
  const make = (kind, business, client, over, items) => {
    const d = newDocument(kind, { settings: s, business });
    const num = kind === 'invoice' ? (business === carpentry ? inv++ : invP++) : (business === carpentry ? est++ : estP++);
    Object.assign(d, { ...TAG, number: formatNumber(kind === 'invoice' ? s.invoicePrefix : s.estimatePrefix, num, s.numberPadding), clientId: client.id, currency: 'USD', items, ...over });
    if (kind === 'invoice' && !d.dueDate) d.dueDate = addDays(d.issueDate, 30);
    if (kind === 'estimate' && !d.validUntil) d.validUntil = addDays(d.issueDate, 30);
    return d;
  };
  const docs = [
    make('invoice', carpentry, maria, { issueDate: daysAgo(3), dueDate: daysAgo(-27), status: 'outstanding', sentAt: new Date().toISOString(), taxLabel: 'Sales Tax', taxRate: '5.5' }, [
      newLineItem({ title: 'Deck board replacement', details: 'Remove and replace 14 damaged pressure-treated boards on the rear deck. Includes disposal of old material.', quantity: '14', unitPrice: '48' }),
      newLineItem({ title: 'Labor', details: 'Two carpenters, one full day', quantity: '16', unitPrice: '65' }),
      newLineItem({ title: 'Stain and seal', details: '', quantity: '1', unitPrice: '240' })
    ]),
    make('invoice', carpentry, hannah, { issueDate: daysAgo(45), dueDate: daysAgo(15), status: 'outstanding', sentAt: new Date().toISOString() }, [
      newLineItem({ title: 'Custom bookshelf', details: 'Built-in oak bookshelf, 8 ft wide, with adjustable shelves and crown molding to match existing trim.', quantity: '1', unitPrice: '2850' }),
      newLineItem({ title: 'Finish', details: 'Hand-rubbed oil finish, two coats', quantity: '1', unitPrice: '320' })
    ]),
    make('invoice', carpentry, tom, { issueDate: daysAgo(60), dueDate: daysAgo(30), status: 'paid', paidAt: new Date().toISOString(), sentAt: new Date().toISOString(), discountType: 'percent', discountValue: '10' }, [
      newLineItem({ title: 'Door installation', details: 'Supply and fit 6 interior doors, including hardware', quantity: '6', unitPrice: '310' }),
      newLineItem({ title: 'Trim repair', details: '', quantity: '3', unitPrice: '85' })
    ]),
    make('invoice', carpentry, liam, { issueDate: daysAgo(12), dueDate: daysAgo(-2), status: 'outstanding', sentAt: new Date().toISOString(), notes: 'Thanks again for the quick turnaround on approvals.' }, [
      newLineItem({ title: 'Café counter', details: 'Reclaimed maple counter top, 12 ft, with live edge and food-safe finish.', quantity: '1', unitPrice: '3400' }),
      newLineItem({ title: 'Delivery and installation', details: '', quantity: '1', unitPrice: '450' })
    ]),
    make('invoice', carpentry, maria, { issueDate: daysAgo(1), status: 'draft' }, [
      newLineItem({ title: 'Fence repair', details: 'Replace 3 fence posts and 2 panels', quantity: '1', unitPrice: '620' })
    ]),
    make('invoice', carpentry, tom, { issueDate: daysAgo(90), dueDate: daysAgo(60), status: 'paid', paidAt: new Date().toISOString(), sentAt: new Date().toISOString() }, [
      newLineItem({ title: 'Porch railing', details: 'Cedar railing with turned balusters, 24 linear ft', quantity: '24', unitPrice: '55' })
    ]),
    make('invoice', pixel, daniel, { issueDate: daysAgo(8), dueDate: daysAgo(-6), status: 'outstanding', sentAt: new Date().toISOString(), taxLabel: 'Tax', taxRate: '0' }, [
      newLineItem({ title: 'Website redesign', details: 'Design and build of a 6-page marketing site:\n- Home, Services, Team, Patients, Contact, Blog\n- Responsive layouts for phone, tablet and desktop\n- Online appointment request form', quantity: '1', unitPrice: '4800' }),
      newLineItem({ title: 'Stock photography', details: '', quantity: '12', unitPrice: '35' })
    ]),
    make('invoice', pixel, priya, { issueDate: daysAgo(20), dueDate: daysAgo(-10), status: 'outstanding', sentAt: new Date().toISOString() }, [
      newLineItem({ title: 'Brand identity package', details: 'Logo, color palette, typography and a 12-page brand guide', quantity: '1', unitPrice: '2400' }),
      newLineItem({ title: 'Business cards', details: 'Design only, print-ready files', quantity: '1', unitPrice: '150' })
    ]),
    make('invoice', pixel, daniel, { issueDate: daysAgo(70), dueDate: daysAgo(40), status: 'paid', paidAt: new Date().toISOString(), sentAt: new Date().toISOString() }, [
      newLineItem({ title: 'Monthly site maintenance', details: 'Updates, backups and security monitoring', quantity: '3', unitPrice: '120' })
    ]),
    make('estimate', carpentry, hannah, { issueDate: daysAgo(2), status: 'open', taxLabel: 'Sales Tax', taxRate: '5.5' }, [
      newSection({ title: 'Phase 1: Demolition and prep' }),
      newLineItem({ title: 'Remove existing cabinets', details: 'Carefully remove upper and lower cabinets, countertop and backsplash. Cap plumbing and electrical. Haul away debris.', quantity: '1', unitPrice: '850' }),
      newLineItem({ title: 'Wall repair', details: 'Patch and skim-coat walls behind removed cabinets; prime ready for paint.', quantity: '1', unitPrice: '420' }),
      newSection({ title: 'Phase 2: Cabinet build and installation' }),
      newLineItem({ title: 'Custom shaker cabinets', details: 'Solid maple frames with plywood boxes, soft-close hinges and drawer slides.\n- 6 upper cabinets (30" tall)\n- 5 base cabinets including a 36" sink base\n- 1 tall pantry cabinet\nPainted finish in client-selected color (Benjamin Moore, sample provided).', quantity: '1', unitPrice: '11800' }),
      newLineItem({ title: 'Installation', details: 'Level, shim and secure all cabinets. Install crown molding, toe kicks and filler panels.', quantity: '24', unitPrice: '75' }),
      newSection({ title: 'Phase 3: Countertop and finishing' }),
      newLineItem({ title: 'Butcher block countertop', details: 'Hard maple, 1.5" thick, 42 sq ft. Sink cutout and edge profile included. Finished with food-safe mineral oil.', quantity: '42', unitPrice: '68' }),
      newLineItem({ title: 'Hardware', details: 'Brushed brass pulls and knobs (allowance; final cost adjusted to actual selection)', quantity: '1', unitPrice: '380' })
    ]),
    make('estimate', carpentry, liam, { issueDate: daysAgo(15), status: 'closed' }, [
      newLineItem({ title: 'Outdoor seating benches', details: 'Four cedar benches, 6 ft each, weather sealed', quantity: '4', unitPrice: '540' })
    ]),
    make('estimate', pixel, priya, { issueDate: daysAgo(5), status: 'open', discountType: 'fixed', discountValue: '200' }, [
      newLineItem({ title: 'Pitch deck design', details: '15 slides, two rounds of revisions, delivered as PowerPoint and PDF', quantity: '1', unitPrice: '1900' }),
      newLineItem({ title: 'Icon set', details: '', quantity: '20', unitPrice: '25' })
    ]),
    make('estimate', pixel, liam, { issueDate: daysAgo(30), status: 'open' }, [
      newLineItem({ title: 'Menu design', details: 'Print menu (2 sizes) and matching chalkboard layout', quantity: '1', unitPrice: '650' })
    ])
  ];
  carpentry.nextInvoiceNumber = inv; carpentry.nextEstimateNumber = est;
  pixel.nextInvoiceNumber = invP; pixel.nextEstimateNumber = estP;
  return docs;
}
