const known: Record<string, string> = {
  JWT_SECRET: 'test-access-secret',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret',
};

export const ENV = new Proxy(known, {
  get: (target, prop: string) => (prop in target ? target[prop] : 'test-stub'),
});
