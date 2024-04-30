# CDK Patched Schema Generator

This GitHub action pulls in the latest changes from `@aws-cdk/aws-service-spec` and generates that schema that cdk-from-cfn needs to a CloudFormation template into CDK a App. The action will create two files: `cdk-resources.json` and `cdk-types.json` at the output path provided in the configuration file.

`cdk-resources.json` contains the entire list of resources in the CloudFormation Resource Specification, CloudFormation Registry Schema, SAM Resource Specification, and SAM JSON Schema, contained in [aws-service-spec](https://github.com/cdklabs/awscdk-service-spec).

`cdk-types.json` contains the CDK compatible type information for all properties and attributes of the resources in `cdk-resources.json`, with patches applied and historical types retained when the types change in CloudFormation et all.

This data is pulled from the sources above as well as from Patches, CloudFormation Docs, and Stateful Resources in [aws-service-spec](https://github.com/cdklabs/awscdk-service-spec).

## Usage

Configure an action that runs one per day:

```yaml
on:
  schedule:
    # Cron format: minute hour day month day-of-the-week
    - cron: '0 0 * * *'
jobs:
  generate_schema:
    runs-on: ubuntu-latest
    steps:
      - uses: cdklabs/cdk-patched-schema-generator@main
      with:
        # Required
        output-path: <path>
```
