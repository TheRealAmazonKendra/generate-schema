import path from 'path';
import * as core from '@actions/core';
import fs from 'fs-extra';
import { Specification, generate } from './generate';

const outputPath: string = core.getInput('output-path');

generate()
  .then((schema: Specification) => {
    fs.writeFileSync(
      path.join(outputPath, 'cdk-resources.json'),
      JSON.stringify(schema.cdkResources, null, 2),
      { encoding: 'utf-8' }
    );
    fs.writeFileSync(
      path.join(outputPath, 'cdk-types.json'),
      JSON.stringify(schema.cdkTypes, null, 2),
      {
        encoding: 'utf-8',
      }
    );
  })
  .catch((error) => {
    core.setFailed(error);
  });
