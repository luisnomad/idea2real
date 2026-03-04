import '@testing-library/jest-dom'

// jsdom doesn't implement URL.createObjectURL — stub it
URL.createObjectURL = () => 'blob:mock-url'
URL.revokeObjectURL = () => {}

// jsdom doesn't implement matchMedia — stub it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
