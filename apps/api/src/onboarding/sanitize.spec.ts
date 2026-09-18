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
  // One form for everyone — there is no account type to vary here any more.
  const profile = {
    firstName: 'Rahim',
    lastName: 'Uddin',
    address: 'House 12, Road 5, Dhanmondi, Dhaka',
    password: 'Workflex@2026',
    confirmPassword: 'Workflex@2026',
  };

  it('rejects a mismatched confirmation', () => {
    const result = onboardingProfileSchema.safeParse({
      ...profile,
      confirmPassword: 'Different@2026',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid profile without an email', () => {
    expect(onboardingProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('rejects a name containing digits', () => {
    const result = onboardingProfileSchema.safeParse({
      ...profile,
      firstName: 'Rahim2',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an address that is too short', () => {
    const result = onboardingProfileSchema.safeParse({
      ...profile,
      address: 'Dhk',
    });
    expect(result.success).toBe(false);
  });

  it('treats email as optional, and blank as absent', () => {
    expect(
      onboardingProfileSchema.safeParse({
        ...profile,
        email: 'rahim@example.com',
      }).success,
    ).toBe(true);
    expect(
      onboardingProfileSchema.safeParse({ ...profile, email: '' }).success,
    ).toBe(true);
  });

  it('rejects a malformed email', () => {
    expect(
      onboardingProfileSchema.safeParse({ ...profile, email: 'not-an-email' })
        .success,
    ).toBe(false);
  });

  it('no longer collects company details at registration', () => {
    // The trade name, registration number and job title moved to the company
    // job-post form, which is the only place they are needed. Registration
    // asks nobody to declare at the front door whether they came to work or
    // to hire.
    //
    // Extra keys are stripped rather than rejected, so a client still sending
    // the old shape registers successfully instead of erroring — worth
    // pinning, because it is what makes the change safe to roll out.
    const result = onboardingProfileSchema.safeParse({
      ...profile,
      accountType: 'COMPANY',
      companyName: 'ACME Foods Ltd',
      companyRegistrationNumber: 'C-123456',
      designation: 'HR Manager',
      tin: '1234',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyName');
      expect(result.data).not.toHaveProperty('accountType');
    }
  });
});
