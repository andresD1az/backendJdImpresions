export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
  testMatch: [
    '**/?(*.)+(test|spec).mjs',
    '**/?(*.)+(test|spec).js'
  ],
  transform: {},
  verbose: true,
};
