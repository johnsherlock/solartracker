import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApplicationStack } from '../lib/application-stack';

test('Account Governer Stack matches snapshot', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new ApplicationStack(app, 'MyTestStack');
  // THEN

  const template = Template.fromStack(stack);

  // template should match snapshot
  expect(template).toMatchSnapshot();
});
