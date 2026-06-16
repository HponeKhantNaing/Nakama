import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class MtmsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for RDS
    const vpc = new ec2.Vpc(this, 'MtmsVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // Database credentials in Secrets Manager
    const dbCredentials = new secretsmanager.Secret(this, 'MtmsDbCredentials', {
      secretName: 'mtms/rds/credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'mtms_admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // RDS PostgreSQL
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: 'Security group for MTMS RDS PostgreSQL',
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from VPC'
    );

    const database = new rds.DatabaseInstance(this, 'MtmsDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'mtms',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      multiAz: false,
      autoMinorVersionUpgrade: true,
      monitoringInterval: cdk.Duration.seconds(60),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
    });

    // S3 Bucket for uploads
    const uploadsBucket = new s3.Bucket(this, 'MtmsUploadsBucket', {
      bucketName: `mtms-uploads-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'expire-old-versions',
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // IAM Role for Amplify / App
    const appRole = new iam.Role(this, 'MtmsAppRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'IAM role for MTMS Amplify application',
    });

    uploadsBucket.grantReadWrite(appRole);
    dbCredentials.grantRead(appRole);

    appRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbCredentials.secretArn],
      })
    );

    // Amplify App
    const amplifyApp = new amplify.CfnApp(this, 'MtmsAmplifyApp', {
      name: 'mtms',
      iamServiceRole: appRole.roleArn,
      environmentVariables: [
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: '/' },
        { name: 'AWS_REGION', value: cdk.Aws.REGION },
        { name: 'AWS_S3_BUCKET_NAME', value: uploadsBucket.bucketName },
        { name: 'DATABASE_SECRET_ARN', value: dbCredentials.secretArn },
      ],
      buildSpec: `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
        - npx prisma generate
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*`,
    });

    const mainBranch = new amplify.CfnBranch(this, 'MtmsMainBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
      framework: 'Next.js - SSR',
      stage: 'PRODUCTION',
    });

    // Lambda: GPS history archival / batch processing
    const gpsProcessor = new lambda.Function(this, 'GpsHistoryProcessor', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('GPS batch processor', JSON.stringify(event));
          return { statusCode: 200, body: 'processed' };
        };
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        DATABASE_SECRET_ARN: dbCredentials.secretArn,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    dbCredentials.grantRead(gpsProcessor);

    new events.Rule(this, 'GpsProcessorSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(gpsProcessor)],
    });

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: dbCredentials.secretArn,
      description: 'Secrets Manager ARN for DB credentials',
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: uploadsBucket.bucketName,
      description: 'S3 bucket for file uploads',
    });

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: amplifyApp.attrAppId,
      description: 'Amplify App ID',
    });

    new cdk.CfnOutput(this, 'AmplifyDefaultDomain', {
      value: `https://main.${amplifyApp.attrDefaultDomain}`,
      description: 'Amplify default domain',
    });
  }
}
