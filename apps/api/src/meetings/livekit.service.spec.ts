import { TokenVerifier } from 'livekit-server-sdk';
import { LivekitService } from './livekit.service';

const settings: Record<string, string | undefined> = {
  LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'a-secret-that-is-long-enough-for-hs256-signing-0123456789',
};
const config = { get: (key: string) => settings[key] } as never;

describe('LivekitService', () => {
  it('knows when it is not set up', () => {
    const service = new LivekitService({ get: () => undefined } as never);
    expect(service.isConfigured()).toBe(false);
  });

  it('signs a pass that opens one room, for one person, and nothing else', async () => {
    const service = new LivekitService(config);
    expect(service.isConfigured()).toBe(true);

    const jwt = await service.tokenFor({
      room: 'wf-abc',
      identity: 'user-1',
      name: 'Rahman Uddin',
      metadata: '{"role":"GUEST"}',
      ttlSeconds: 3600,
    });

    const claims = await new TokenVerifier(settings.LIVEKIT_API_KEY!, settings.LIVEKIT_API_SECRET!).verify(jwt);
    expect(claims.sub).toBe('user-1');
    expect(claims.name).toBe('Rahman Uddin');
    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: 'wf-abc',
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    // Not an admin pass: it cannot list, create or delete rooms.
    expect(claims.video?.roomAdmin).toBeFalsy();
    expect(claims.video?.roomCreate).toBeFalsy();
    expect(claims.exp! - claims.nbf!).toBeGreaterThan(3500);
    expect(claims.exp! - claims.nbf!).toBeLessThanOrEqual(3700);
  });

  it('is refused by a verifier holding a different secret', async () => {
    const jwt = await new LivekitService(config).tokenFor({ room: 'r', identity: 'u', name: 'n', ttlSeconds: 60 });
    await expect(new TokenVerifier('devkey', 'some-other-secret-that-is-also-long-enough-000000').verify(jwt)).rejects.toBeDefined();
  });
});
