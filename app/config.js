// App configuration: name and branding. Presets, item catalog and note snippets live in presets.js.
import { presets, catalog, snippets, headingPresets } from './presets.js';

export default {
  appName: 'Mini Thermal Printer',
  storageKey: 'mini-thermal-printer-v1',
  logPrefix: 'session',
  logEndpoint: '/api/log',
  brand: {
    shopName: 'Your Shop Name',
    tagline: '', // optional line under the name (Heading tab)
    info: '', // optional extra lines (phone, web, address)
    headStyle: 'classic',
    nameScale: 2,
    showLogo: true,
    footer: 'Thank you!',
    currency: '$',
  },
  presets,
  catalog,
  snippets,
  headingPresets,
};
