import { loadAwsServiceSpec } from '@aws-cdk/aws-service-spec';
import { PropertyType } from '@aws-cdk/service-spec-types';
import { Type } from '@cdklabs/typewriter';

interface GenerateModuleOptions {
  /**
   * List of services to generate files for.
   *
   * In CloudFormation notation.
   *
   * @example ["AWS::Lambda", "AWS::S3"]
   */
  readonly services: string[];
}

interface GenerateModuleMap {
  [name: string]: GenerateModuleOptions;
}

interface ResourceOptions {
  construct: { [key: string]: any };
  attributes: { [key: string]: any };
  properties: { [key: string]: any };
}

interface ResourceTypeMap {
  [name: string]: ResourceOptions;
}

export interface Specification {
  cdkResources: { [key: string]: any };
  cdkTypes: { [key: string]: any };
}

export async function generate(): Promise<Specification> {
  const db = await loadAwsServiceSpec();
  const services = db.all('service');
  const resources = db.all('resource');
  const types = db.all('typeDefinition');

  const modules: GenerateModuleMap = {};
  const moduleMap: { [key: string]: any } = {};

  for (const service of services) {
    modules[service.name] = {
      services: [service.cloudFormationNamespace],
    };
  }

  const propertyRefList: { [key: string]: any } = {};
  let resourceTypes: ResourceTypeMap = {};
  const propertyTypes: { [key: string]: any } = {};
  const propertyTypeKeyList: { [key: string]: any } = {};

  for (const [moduleName, moduleOptions] of Object.entries(modules)) {
    moduleMap[moduleName] = moduleOptions.services
      .flatMap((namespace) => db.lookup('service', 'cloudFormationNamespace', 'equals', namespace))
      .map((s) => {
        const r = db.follow('hasResource', s);
        return r.flatMap((resource) => resource);
      });
  }

  const getType = (propType: PropertyType, cfnType: string) => {
    let refIds: Record<string, any> = {};
    const doGetType = (_propType: PropertyType, _cfnType: string) => {
      const toTypewriterType = ((): any => {
        switch (_propType.type) {
          case 'string':
            return Type.STRING.spec;
          case 'boolean':
            return Type.BOOLEAN.spec;
          case 'number':
            return Type.NUMBER.spec;
          case 'integer':
            return Type.NUMBER.spec;
          case 'date-time':
            return Type.DATE_TIME.spec;
          case 'ref':
            const ref = db.get('typeDefinition', _propType.reference.$ref);
            refIds[ref.$id] = ref.name;
            return { named: `${_cfnType}.${ref.name}` };
          case 'array':
            return { listOf: doGetType(_propType.element, _cfnType) };
          case 'json':
            return { primitive: 'json' };
          case 'map':
            return { mapOf: doGetType(_propType.element, _cfnType) };
          case 'tag':
            return { named: 'CfnTag' };
          case 'union':
            const union = _propType.types.map((t) => {
              return doGetType(t, _cfnType);
            });
            return { unionOf: union };
          case 'null':
            return Type.UNDEFINED.spec;
        }
      })();
      return toTypewriterType;
    };
    return { type: doGetType(propType, cfnType), ids: refIds };
  };

  for (const resource of Object.values(resources)) {
    const cloudFormationType = resource.cloudFormationType;
    resourceTypes[cloudFormationType] = {
      construct: {},
      attributes: {},
      properties: {},
    };

    const serviceType = cloudFormationType.split('::').slice(0, 2).join('::');
    const service = db.lookup('service', 'cloudFormationNamespace', 'equals', serviceType).only();
    const name = `Cfn${resource.name}`;
    const goPackage = service.name.replace('-', '');
    resourceTypes[cloudFormationType].construct = {
      typescript: {
        module: `aws-cdk-lib/${service.name}`,
        name,
      },
      csharp: {
        namespace: `Amazon.CDK.${service.cloudFormationNamespace.replace('::', '.')}`,
        name,
      },
      golang: {
        module: `github.com/aws/aws-cdk-go/awscdk/v2/${goPackage}`,
        package: goPackage,
        name,
      },
      java: {
        package: `software.amazon.awscdk.${service.name.replace('-', '.').replace('aws', 'services')}`,
        name,
      },
      python: {
        module: `aws_cdk.${service.name.replace('-', '_')}`,
        name,
      },
    };

    const attributeList: { [key: string]: any } = {};
    Object.entries(resource.attributes).map(([id, attribute]) => {
      let type = getType(attribute.type, cloudFormationType);
      Object.entries(type.ids).map(([_id, _type]) => {
        propertyRefList[_id] = `${resource.cloudFormationType}.${_type}`;
      });

      const previousType = attribute.previousTypes
        ?.map((t) => getType(t, cloudFormationType).type)
        .pop();

      attributeList[id] = {
        name: id,
        valueType: type.type,
        previousType,
      };

      resourceTypes[resource.cloudFormationType].attributes = attributeList;
    });

    const resourceProperties: { [key: string]: any } = {};
    Object.entries(resource.properties).map(([id, property]) => {
      let type = getType(property.type, cloudFormationType);
      Object.entries(type.ids).map(([_id, _type]) => {
        propertyRefList[_id] = `${resource.cloudFormationType}.${_type}`;
      });

      const previousType = property.previousTypes
        ?.map((t) => getType(t, cloudFormationType).type)
        .pop();

      resourceProperties[id] = {
        name: id,
        valueType: previousType ?? type.type,
        required: property.required,
      };

      resourceTypes[resource.cloudFormationType].properties = resourceProperties;
    });
  }

  let resourceName: string | undefined;
  for (const type of Object.values(types)) {
    const propertyTypeDetails: { [key: string]: any } = {};
    resourceName = (
      (Object.entries(propertyRefList).find(([id, _]) => {
        return type.$id === id;
      })?.[1] as string) ?? resourceName
    ).split('.')[0];

    const shortPropertyName = `${type.name}Property`;
    const fullPropertyName = `${resourceName}.${shortPropertyName}`;
    propertyTypes[fullPropertyName] = {};
    const resourceNameParts = resourceName.split('::');
    const propertyName = `Cfn${resourceNameParts.pop()!}.${shortPropertyName}`;

    const serviceType = resourceNameParts.join('::');
    const service = db.lookup('service', 'cloudFormationNamespace', 'equals', serviceType).only();
    const goPackage = service.name.replace('-', '');

    propertyTypes[fullPropertyName] = {
      name: {
        typescript: {
          module: `aws-cdk-lib/${service.name}`,
          name: propertyName,
        },
        csharp: {
          namespace: `Amazon.CDK.${resourceNameParts.join('.')}`,
          name: propertyName,
        },
        golang: {
          module: `github.com/aws/aws-cdk-go/awscdk/v2/${goPackage}`,
          package: goPackage,
          name: propertyName.replace('.', '_'),
        },
        java: {
          package: `software.amazon.awscdk.${service.name.replace('-', '.').replace('aws', 'services')}`,
          name: propertyName,
        },
        python: {
          module: `aws_cdk.${service.name.replace('-', '_')}`,
          name: propertyName,
        },
      },
    };

    Object.entries(type.properties).map(([id, property]) => {
      const previousType = property.previousTypes?.map((t) => getType(t, resourceName!).type).pop();

      let propType = getType(property.type, resourceName!);
      propertyTypeDetails[id] = {
        name: id,
        valueType: previousType ?? propType.type,
        required: property.required,
      };
    });
    propertyTypes[fullPropertyName].properties = propertyTypeDetails;
    propertyTypeKeyList[type.$id] = fullPropertyName;
  }

  return {
    cdkTypes: propertyTypes,
    cdkResources: resourceTypes,
  };
}
