export interface SiteAdapter {
  readonly id: string;
  readonly matches: (url: string) => boolean;
  readonly scrapeJobPosting: () => RawScrape;
  readonly scrapeFormFields: () => FormField[];
  readonly fillField: (field: FormField, value: string) => void;
}

export interface FormField {
  readonly label: string;
  readonly type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  readonly selector: string;
  readonly maxLength?: number;
}

export interface RawScrape {
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description: string;
  readonly sourceUrl: string;
}