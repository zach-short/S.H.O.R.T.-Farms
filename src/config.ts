export const ION_TOKEN =
  import.meta.env.VITE_CESIUM_ION_TOKEN ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwOTdkMGI2MC01NTlhLTRlMGMtYmM1ZS1iYzg4OTY1NjIwNWQiLCJpZCI6NDYwNDI2LCJzdWIiOiJlemhvbWVzdGVhZGluZyIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiJTaG9ydCBGYXJtcyIsImlhdCI6MTc4NDk4NjM0Nn0.rGsM3v6XA6B5Kuo_-nLYwqkDS5DtR06yT7SeZ4PLh3k';

export const PARCEL_CENTER = { lon: -76.651731, lat: 37.032344 };

export const CAMERA = {
  pitch: -32,
  heading: 15,
  rangeFactor: 2.2,
  fallbackRange: 1400,
};

export const BUNDLED_KML = { name: 'Farm.kml', url: '/Farm.kml' };

export const STORAGE_KEY = 'farm-planner/v1';
