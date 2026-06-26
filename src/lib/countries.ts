// Country defaults for StockFlow onboarding and organization settings.
// Currency and timezone are the standard defaults for each country.

export interface CountryDefault {
  code: string
  name: string
  currency: string
  timezone: string
}

export const COUNTRY_DEFAULTS: readonly CountryDefault[] = [
  { code: 'BJ', name: 'Bénin', currency: 'XOF', timezone: 'Africa/Abidjan' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', timezone: 'Africa/Abidjan' },
  { code: 'CM', name: 'Cameroun', currency: 'XAF', timezone: 'Africa/Lagos' },
  { code: 'CF', name: 'Centrafrique', currency: 'XAF', timezone: 'Africa/Lagos' },
  { code: 'TD', name: 'Tchad', currency: 'XAF', timezone: 'Africa/Lagos' },
  { code: 'KM', name: 'Comores', currency: 'KMF', timezone: 'Africa/Nairobi' },
  { code: 'CG', name: 'Congo', currency: 'XAF', timezone: 'Africa/Lagos' },
  {
    code: 'CD',
    name: 'Congo, République démocratique',
    currency: 'CDF',
    timezone: 'Africa/Kinshasa',
  },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', timezone: 'Africa/Abidjan' },
  { code: 'DJ', name: 'Djibouti', currency: 'DJF', timezone: 'Africa/Nairobi' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', timezone: 'Africa/Lagos' },
  { code: 'GN', name: 'Guinée', currency: 'GNF', timezone: 'Africa/Abidjan' },
  { code: 'GW', name: 'Guinée-Bissau', currency: 'XOF', timezone: 'Africa/Abidjan' },
  { code: 'MG', name: 'Madagascar', currency: 'MGA', timezone: 'Africa/Nairobi' },
  { code: 'ML', name: 'Mali', currency: 'XOF', timezone: 'Africa/Abidjan' },
  { code: 'MR', name: 'Mauritanie', currency: 'MRU', timezone: 'Africa/Abidjan' },
  { code: 'NE', name: 'Niger', currency: 'XOF', timezone: 'Africa/Abidjan' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', timezone: 'Africa/Kigali' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF', timezone: 'Africa/Abidjan' },
  { code: 'SC', name: 'Seychelles', currency: 'SCR', timezone: 'Africa/Nairobi' },
  { code: 'TG', name: 'Togo', currency: 'XOF', timezone: 'Africa/Abidjan' },
  { code: 'TN', name: 'Tunisie', currency: 'TND', timezone: 'Africa/Tunis' },
  // Additional common choices
  { code: 'FR', name: 'France', currency: 'EUR', timezone: 'Europe/Paris' },
  { code: 'BE', name: 'Belgique', currency: 'EUR', timezone: 'Europe/Brussels' },
  { code: 'CA', name: 'Canada', currency: 'CAD', timezone: 'America/Toronto' },
  { code: 'CH', name: 'Suisse', currency: 'CHF', timezone: 'Europe/Zurich' },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP', timezone: 'Europe/London' },
  { code: 'US', name: 'États-Unis', currency: 'USD', timezone: 'America/New_York' },
]

export const COUNTRY_DEFAULTS_BY_CODE: Readonly<Record<string, CountryDefault>> =
  COUNTRY_DEFAULTS.reduce<Record<string, CountryDefault>>((acc, country) => {
    acc[country.code] = country
    return acc
  }, {})

export const CURRENCIES = [
  { value: 'XOF', label: 'Franc CFA BCEAO (XOF)' },
  { value: 'XAF', label: 'Franc CFA BEAC (XAF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar US (USD)' },
  { value: 'GBP', label: 'Livre sterling (GBP)' },
  { value: 'CAD', label: 'Dollar canadien (CAD)' },
  { value: 'CHF', label: 'Franc suisse (CHF)' },
  { value: 'KMF', label: 'Franc comorien (KMF)' },
  { value: 'DJF', label: 'Franc djiboutien (DJF)' },
  { value: 'GNF', label: 'Franc guinéen (GNF)' },
  { value: 'MGA', label: 'Ariary malgache (MGA)' },
  { value: 'MRU', label: 'Ouguiya mauritanien (MRU)' },
  { value: 'RWF', label: 'Franc rwandais (RWF)' },
  { value: 'SCR', label: 'Roupie seychelloise (SCR)' },
  { value: 'CDF', label: 'Franc congolais (CDF)' },
  { value: 'TND', label: 'Dinar tunisien (TND)' },
] as const

export const TIMEZONES = [
  { value: 'Africa/Abidjan', label: 'Abidjan / Dakar / Bamako (UTC+0)' },
  { value: 'Africa/Kigali', label: 'Kigali (UTC+2)' },
  { value: 'Africa/Kinshasa', label: 'Kinshasa (UTC+1)' },
  { value: 'Africa/Lagos', label: 'Lagos / Douala / Libreville (UTC+1)' },
  { value: 'Africa/Nairobi', label: 'Nairobi / Djibouti (UTC+3)' },
  { value: 'Africa/Tunis', label: 'Tunis (UTC+1)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Toronto', label: 'Toronto (UTC-5/-4)' },
  { value: 'Europe/Brussels', label: 'Bruxelles (UTC+1/+2)' },
  { value: 'Europe/London', label: 'Londres (UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
  { value: 'Europe/Zurich', label: 'Zurich (UTC+1/+2)' },
] as const

export function getCountryDefault(code: string | null | undefined): CountryDefault | undefined {
  if (!code) return undefined
  return COUNTRY_DEFAULTS_BY_CODE[code]
}
