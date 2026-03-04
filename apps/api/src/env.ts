export const env = {
  PORT: parseInt(process.env['PORT'] ?? '3000', 10),
  LOG_LEVEL: process.env['LOG_LEVEL'] ?? 'info',
  VERSION: process.env['npm_package_version'] ?? '0.0.0',
}
