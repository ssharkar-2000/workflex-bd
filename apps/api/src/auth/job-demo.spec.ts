// Test 6: Job Application Testing
import { describe, expect, test } from '@jest/globals';

describe('Job Application Testing', () => {
  test('Job application status should be submitted', () => {
    const jobId = 'JOB-101';
    const userId = 'USER-01';
    const application = {
      jobId,
      userId,
      status: 'submitted',
    };
    expect(application.jobId).toBe('JOB-101');
    expect(application.userId).toBe('USER-01');
    expect(application.status).toBe('submitted');
  });
});
