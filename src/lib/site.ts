export const SITE = {
  url: 'https://bloomwood.com.au',
  name: 'Bloomwood',
  solutionsName: 'Bloomwood Solutions',
  mediaName: 'Bloomwood Media',

  phone: '+61492991759',
  email: 'help@bloomwood.com.au',

  address: {
    streetAddress: '7 Hook Close',
    addressLocality: 'Brinsmead',
    addressRegion: 'QLD',
    postalCode: '4870',
    addressCountry: 'AU',
  },

  googleMapsUrl: 'https://maps.app.goo.gl/EN4J1vT1SzEZoXZm7?g_st=ic',

  sameAs: [
    'https://www.facebook.com/bloomwoodsolutions',
    'https://www.instagram.com/bloomwoodsolutions',
    'https://business.google.com/n/1200256559802987654/profile?hl=en&fid=3530029134441265961',
  ],

  // Public brand image assets
  // Note: in Astro/CF Pages, assets in /public are served from the site root.
  logoUrl: 'https://bloomwood.com.au/logo.svg',
  imageUrl: 'https://bloomwood.com.au/logo.svg',

  // By-appointment opening hours
  openingHours: {
    weekdays: { opens: '09:00', closes: '20:30' },
    weekends: { opens: '09:00', closes: '17:00' },
    byAppointment: true,
  },

  areaServed: 'Cairns, QLD (up to 80km)'
} as const;
