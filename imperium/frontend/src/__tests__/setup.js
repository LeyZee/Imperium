import '@testing-library/jest-dom';

// Mock IntersectionObserver for jsdom
class MockIntersectionObserver {
  constructor(callback) {
    this._callback = callback;
  }
  observe() {
    // Trigger immediately as "intersecting" so animations fire in tests
    this._callback([{ isIntersecting: true }]);
  }
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = MockIntersectionObserver;
