import {
  onboardingProfileSchema,
  passwordSchema,
  sanitizeAddress,
  sanitizeDigits,
  sanitizeEmail,
  sanitizeOrganisationName,
  sanitizePersonName,
  sanitizeReferenceNumber,
} from '@workflex/shared';

describe('input sanitisers', () => {
  it('strips digits and symbols from a person name but keeps Bangla', () => {
    expect(sanitizePersonName('Rahim123!@#')).toBe('Rahim');
    expect(sanitizePersonName('রহিম উদ্দিন')).toBe('রহিম উদ্দিন');
    expect(sanitizePersonName("O'Brien-Smith")).toBe("O'Brien-Smith");
  });

  it('keeps digits and business punctuation in a company name', () => {
    expect(sanitizeOrganisationName('ACME Foods & Co. (Pvt) Ltd')).toBe(
      'ACME Foods & Co. (Pvt) Ltd',
    );
    expect(sanitizeOrganisationName('Bad<script>Name')).toBe('BadscriptName');
  });

  it('upper-cases reference numbers and drops separators we do not allow', () => {
    expect(sanitizeReferenceNumber('c-12345/ab')).toBe('C-12345/AB');
    expect(sanitizeReferenceNumber('TL#99*88')).toBe('TL9988');
  });

  it('keeps address punctuation but removes angle brackets', () => {
    expect(sanitizeAddress('House 12/A, Road #5, Dhanmondi')).toBe(
      'House 12/A, Road #5, Dhanmondi',
    );
    expect(sanitizeAddress('Road <b>5</b>')).toBe('Road b5/b');
  });

  it('reduces to digits and truncates', () => {
    expect(sanitizeDigits('01712-345678')).toBe('01712345678');
    expect(sanitizeDigits('0171234567890', 11)).toBe('01712345678');
  });

  it('lower-cases emails and removes whitespace', () => {
    expect(sanitizeEmail('  Someone@Example.COM ')).toBe('someone@example.com');
  });
});

describe('passwordSchema', () => {
  it.each([
    ['Workflex@2026', true],
    ['Short1!', false],
    ['alllowercase1!', false],
    ['ALLUPPERCASE1!', false],
    ['NoDigitsHere!', false],
    ['NoSpecial2026', false],
  ])('%s -> %s', (value, expected) => {
    expect(passwordSchema.safeParse(value).success).toBe(expected);
  });
});

describe('onboardingProfileSchema', () => {
  const individual = {
    accountType: 'INDIVIDUAL' as const,
    firstName: 'Rahim',
    lastName: 'Uddin',
    address: 'House 12, Road 5, Dhanmondi, Dhaka',
    password: 'Workflex@2026',
    confirmPassword: 'Workflex@2026',
  };

  it('rejects a mismatched confirmation', () => {
    const result = onboardingProfileSchema.safeParse({
      ...individual,
      confirmPassword: 'Different@2026',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid individual without an email', () => {
    expect(onboardingProfileSchema.safeParse(individual).success).toBe(true);
  });

  it('rejects a name containing digits', () => {
    const result = onboardingProfileSchema.safeParse({
      ...individual,
      firstName: 'Rahim2',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an address that is too short', () => {
    const result = onboardingProfileSchema.safeParse({
      ...individual,
      address: 'Dhk',
    });
    expect(result.success).toBe(false);
  });

  it('requires registration number and designation for a company', () => {
    const result = onboardingProfileSchema.safeParse({
      accountType: 'COMPANY',
      firstName: 'Rahim',
      lastName: 'Uddin',
      companyName: 'ACME Foods Ltd',
      address: 'House 12, Road 5, Dhanmondi, Dhaka',
      password: 'Workflex@2026',
      confirmPassword: 'Workflex@2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a TIN that is not 9 to 15 digits', () => {
    const base = {
      accountType: 'COMPANY' as const,
      firstName: 'Rahim',
      lastName: 'Uddin',
      companyName: 'ACME Foods Ltd',
      companyRegistrationNumber: 'C-123456',
      designation: 'HR Manager',
      address: 'House 12, Road 5, Dhanmondi, Dhaka',
      password: 'Workflex@2026',
      confirmPassword: 'Workflex@2026',
    };

    expect(
      onboardingProfileSchema.safeParse({ ...base, tin: '1234' }).success,
    ).toBe(false);
    expect(
      onboardingProfileSchema.safeParse({ ...base, tin: '123456789012' })
        .success,
    ).toBe(true);
    // Blank stays acceptable: TIN is optional at this step.
    expect(
      onboardingProfileSchema.safeParse({ ...base, tin: '' }).success,
    ).toBe(true);
  });
});
