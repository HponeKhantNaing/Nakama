#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MtmsStack } from '../lib/mtms-stack';

const app = new cdk.App();

new MtmsStack(app, 'MtmsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  description: 'Maruichi Transport Management System Infrastructure',
});
