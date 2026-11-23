/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Break the cycle by moving the shared piece into its own module that both sides import.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'lib-is-leaf',
      severity: 'error',
      comment: 'src/lib is domain logic: it must not import UI. Move the shared code into src/lib instead.',
      from: { path: '^src/lib' },
      to: { path: '^src/(components|app)' },
    },
    {
      name: 'components-not-app',
      severity: 'error',
      comment: 'Components must not import route modules. Lift the shared code into src/components or src/lib.',
      from: { path: '^src/components' },
      to: { path: '^src/app' },
    },
    {
      name: 'src-not-tests',
      severity: 'error',
      comment: 'Production code must not import tests or e2e specs.',
      from: { path: '^src' },
      to: { path: '^(tests|e2e)/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(\\.next|node_modules)' },
  },
}
