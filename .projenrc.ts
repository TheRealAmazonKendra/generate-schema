import { GitHubActionTypeScriptProject, RunsUsing } from 'projen-github-action-typescript';
const project = new GitHubActionTypeScriptProject({
  defaultReleaseBranch: 'main',
  devDeps: ['projen-github-action-typescript', '@types/fs-extra'],
  name: 'cdk-patched-schema-generator',
  projenrcTs: true,
  deps: [
    '@octokit/graphql',
    '@actions/core',
    '@actions/github',
    '@octokit/rest',
    '@aws-cdk/aws-service-spec',
    '@aws-cdk/service-spec-types',
    '@cdklabs/typewriter',
    'fs-extra',
  ],
  actionMetadata: {
    author: 'Kendra Neil',
    runs: {
      main: 'dist/index.js',
      using: RunsUsing.NODE_20,
    },
    inputs: {
      'output-path': {
        description: 'The path to write the output files to',
        required: true,
      },
    },
  },
  eslintOptions: {
    prettier: true,
    dirs: ['src', 'test'],
  },
});

project.package.addField('prettier', {
  singleQuote: true,
  semi: true,
  trailingComma: 'es5',
  printWidth: 100,
});

project.eslint?.addRules({
  'prettier/prettier': [
    'error',
    { singleQuote: true, semi: true, trailingComma: 'es5', printWidth: 100 },
  ],
});

project.postCompileTask.exec('cp node_modules/@aws-cdk/aws-service-spec/db.json.gz db.json.gz');

project.synth();
