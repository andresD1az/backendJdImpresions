import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  reporters: (() => {
    const hasTR = !!(
      process.env.TESTRAIL_HOST &&
      process.env.TESTRAIL_USERNAME &&
      process.env.TESTRAIL_API_KEY &&
      process.env.TESTRAIL_PROJECT_ID &&
      process.env.TESTRAIL_SUITE_ID
    )
    const base: any[] = ['default']
    if (hasTR) {
      base.push([
        'jest-testrail-reporter',
        {
          host: process.env.TESTRAIL_HOST,
          username: process.env.TESTRAIL_USERNAME,
          password: process.env.TESTRAIL_API_KEY,
          projectId: Number(process.env.TESTRAIL_PROJECT_ID),
          suiteId: Number(process.env.TESTRAIL_SUITE_ID),
          createTestRun: true,
          runName: `API Tests - ${new Date().toISOString()}`,
          includeAllInTestRun: true,
          testTitlePattern: 'C(\\d+)',
        },
      ])
    }
    return base
  })(),
}

export default config
