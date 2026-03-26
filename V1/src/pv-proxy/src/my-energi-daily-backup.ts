import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';

import { getHttpResult } from './http-utils';
import { MyEnergiService } from './my-energi-service';
import { EddiData } from '../../shared/eddi-data';
import { EnergyCalculator } from '../../shared/energy-calculator';
import { mapEddiDataToMinutePVData, convertMinuteDataToHalfHourlyData } from '../../shared/energy-utils';
import { HalfHourlyPVData, MinutePVData } from '../../shared/pv-data';

const username = process.env.MYENERGI_USERNAME;
const password = process.env.MYENERGI_PASSWORD;
const tableName = process.env.EDDI_DATA_TABLE_NAME ?? 'PVData';
const bucketName = process.env.EDDI_DATA_BUCKET_NAME ?? 'eddi-backup';
const myenergiAPIEndpoint = 'https://director.myenergi.net';

if (!username || !password) {
  throw new Error('MYENERGI_USERNAME and MYENERGI_PASSWORD must be set as environment variables.');
}

const myEnergiService = new MyEnergiService(myenergiAPIEndpoint);

const dynamoClient = new DynamoDBClient({ region: 'eu-west-1' });
const s3Client = new S3Client({ region: 'eu-west-1' });

// TODO: Initialise this dynamically (from props or per user)
const energyCalculator = new EnergyCalculator({
  dayRate: 0.4673,
  peakRate: 0.5709,
  nightRate: 0.3434,
  exportRate: 0.1850,
  discountPercentage: 0.15,
  annualStandingCharge: 257.91,
  monthlyPsoCharge: 12.73,
});

export const handler = async (event: any, context: any) => {
  try {

    let date = event.queryStringParameters?.date || event?.body?.date || event?.date;

    console.log(`date: ${date}`);

    // if date is not provided, use yesterday's date in the format YYYY-MM-DD
    if (!date) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      date = yesterday.toISOString().split('T')[0];
    }

    console.log(`Fetching data for ${date}...`);

    const data: EddiData[] = await myEnergiService.getEddiData(date, { serialNumber: username, password: password });

    if (!data || data.length === 0) {
      const message = `No data returned for ${date}`;
      console.log(message);
      return getHttpResult(404, message);
    }

    console.log(`Fetched data for ${date}.`, data);
    await writeToDynamo(data, date);
    await uploadToS3(data, date);

    return getHttpResult(200, 'Data written to DynamoDB and uploaded to S3 for date ' + date);
  } catch (error) {
    console.error(error);
    return getHttpResult(500, JSON.stringify({ error }));
  }
};

const writeToDynamo = async (data: EddiData[], date: string) => {
  const minuteData: MinutePVData[] = data.map(mapEddiDataToMinutePVData);
  const halfHourData: HalfHourlyPVData[] = convertMinuteDataToHalfHourlyData(minuteData);
  const totals = energyCalculator.calculateTotals(halfHourData);

  console.log(`Writing summarised data to DynamoDB for user ${username} and date ${date}...`);

  // update dynamo entry for "serialNumber" with "data" for "date"
  const params = {
    TableName: tableName,
    Item: {
      serialNumber: { S: username },
      date: { S: date },
      data: { S: JSON.stringify(totals) },
    },
  };

  const command = new PutItemCommand(params as PutItemCommandInput);
  await dynamoClient.send(command);

  console.log('Wrote data to DynamoDB.');
};

const uploadToS3 = async (data: EddiData[], date: string) => {
  // upload data to S3
  const params: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: `${username}/${date}.json`,
    Body: JSON.stringify(data),
  };

  const command = new PutObjectCommand(params as PutObjectCommandInput);

  console.log(`Uploading raw data to s3 for user ${username} and date ${date}...`);

  await s3Client.send(command);

  console.log('Data uploaded to S3.');
};