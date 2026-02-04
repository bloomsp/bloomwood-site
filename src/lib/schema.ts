import { SITE } from './site';

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
  };
}

export function organizationSchema() {
  const org: any = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
  };
  if ((SITE as any).logoUrl) org.logo = (SITE as any).logoUrl;
  if ((SITE as any).imageUrl) org.image = (SITE as any).imageUrl;
  if ((SITE as any).sameAs) org.sameAs = (SITE as any).sameAs;
  if (SITE.phone) org.telephone = SITE.phone;
  if (SITE.email) org.email = SITE.email;
  if ((SITE as any).address) {
    org.address = {
      '@type': 'PostalAddress',
      ...(SITE as any).address,
    };
  }
  if ((SITE as any).googleMapsUrl) org.hasMap = (SITE as any).googleMapsUrl;
  return org;
}

function openingHoursSpecification() {
  const oh: any = (SITE as any).openingHours;
  if (!oh) return undefined;

  const specs = [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: oh.weekdays?.opens,
      closes: oh.weekdays?.closes,
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday', 'Sunday'],
      opens: oh.weekends?.opens,
      closes: oh.weekends?.closes,
    },
  ].filter((s) => s.opens && s.closes);

  return specs.length ? specs : undefined;
}

export function localBusinessSchema(overrides: Record<string, any> = {}) {
  const base: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: SITE.solutionsName,
    url: `${SITE.url}/solutions/`,
    areaServed: SITE.areaServed,
  };
  if (SITE.phone) base.telephone = SITE.phone;
  if (SITE.email) base.email = SITE.email;
  if ((SITE as any).address) {
    base.address = {
      '@type': 'PostalAddress',
      ...(SITE as any).address,
    };
  }
  if ((SITE as any).googleMapsUrl) base.hasMap = (SITE as any).googleMapsUrl;
  if ((SITE as any).logoUrl) base.logo = (SITE as any).logoUrl;
  if ((SITE as any).imageUrl) base.image = (SITE as any).imageUrl;
  if ((SITE as any).sameAs) base.sameAs = (SITE as any).sameAs;

  const ohSpec = openingHoursSpecification();
  if (ohSpec) base.openingHoursSpecification = ohSpec;

  // If you want to communicate "by appointment" explicitly, you can also add it to the name/description
  // or via a dedicated page section. (Schema.org doesn't have a perfect dedicated field for it.)

  return { ...base, ...overrides };
}

export function serviceSchema(params: {
  name: string;
  url: string;
  providerName?: string;
  areaServed?: string;
  serviceType?: string;
  description?: string;
}) {
  const s: any = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: params.name,
    url: params.url,
  };
  if (params.description) s.description = params.description;
  if (params.serviceType) s.serviceType = params.serviceType;
  s.provider = {
    '@type': 'LocalBusiness',
    name: params.providerName ?? SITE.solutionsName,
    url: `${SITE.url}/solutions/`,
  };
  s.areaServed = params.areaServed ?? SITE.areaServed;
  return s;
}
