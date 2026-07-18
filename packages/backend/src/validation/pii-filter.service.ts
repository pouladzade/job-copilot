import { Injectable } from '@nestjs/common';

interface PiiPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

const PII_PATTERNS: readonly PiiPattern[] = [
  { name: 'SSN (US)', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED-SSN]' },
  { name: 'Credit Card', regex: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[REDACTED-CC]' },
  { name: 'EIN', regex: /\b\d{2}-\d{7}\b/g, replacement: '[REDACTED-EIN]' },
];

@Injectable()
export class PiiFilterService {
  filter(text: string): { clean: string; warnings: string[] } {
    const warnings: string[] = [];
    let clean = text;

    for (const pattern of PII_PATTERNS) {
      if (pattern.regex.test(clean)) {
        warnings.push(`PII pattern detected: ${pattern.name}. Redacted before sending to API.`);
        clean = clean.replace(pattern.regex, pattern.replacement);
      }
    }

    return { clean, warnings };
  }
}