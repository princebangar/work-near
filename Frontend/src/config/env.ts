export const env = {
  useMock: import.meta.env.VITE_USE_MOCK !== 'false',
  apiUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1',
} as const;

export const APP = {
  name: 'WorkNear',
  radiusOptions: [5, 10, 15] as const,
  defaultRadiusKm: 5,
  demoOtp: '123456',
  supportEmail: 'support@worknear.in',
} as const;
