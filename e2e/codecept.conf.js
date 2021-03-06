exports.config = {
  tests: './*_test.ts',
  helpers: {
    Playwright: {
      url: 'http://localhost:3000',
      show: !process.env.CI,
      browser: process.env.BROWSER || 'chromium'
    }
  },
  plugins: {
    customLocator: {
      enabled: true,
      attribute: 'data-test-id'
    }
  },
  require: ["ts-node/register"]
}
