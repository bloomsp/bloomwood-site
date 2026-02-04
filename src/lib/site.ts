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

  // By-appointment opening hours
  openingHours: {
    weekdays: { opens: '09:00', closes: '20:30' },
    weekends: { opens: '09:00', closes: '17:00' },
    byAppointment: true,
  },

  areaServed: 'Cairns, QLD (up to 80km)'
} as const;
