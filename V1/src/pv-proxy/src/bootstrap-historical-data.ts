import { LambdaClient, InvokeCommand, TooManyRequestsException } from '@aws-sdk/client-lambda';
import { parallelLimit } from 'async';
import moment from 'moment';
import { getHttpResult } from './http-utils';

const lambda = new LambdaClient({ region: 'eu-west-1' });

const dailyBackupLambda = process.env.MYENERGI_DAILY_BACKUP_LAMBDA ?? 'MyEnergiDailyBackup';

interface BatchProcessingResponse {
  successDates: string[];
  notFoundDates: string[];
  throttledDates: string[];
  errorDates: string[];
}

const batchInvokeLambda = async (dates: string[]): Promise<BatchProcessingResponse> => {

  const batchResponse: BatchProcessingResponse = {
    successDates: [],
    notFoundDates: [],
    throttledDates: [],
    errorDates: [],
  };

  const results = await new Promise<any>((resolve) => {
    const tasks = [];
    for (let i = 0; i < dates.length; i++) {
      const dateString = dates[i];
      const payload = { date: dateString };

      const command = new InvokeCommand({
        FunctionName: dailyBackupLambda,
        Payload: Buffer.from(JSON.stringify(payload), 'utf8'),
      });

      tasks.push(async () => {
        try {
          const response = await lambda.send(command);

          // convert the payload from a Uint8Array to a string
          const strPayload = Buffer.from(response.Payload!.buffer).toString();
          console.log('Response: ', strPayload);

          // parse the payload as JSON
          const responsePayload = JSON.parse(strPayload);

          const statusCode = responsePayload.statusCode;

          if (statusCode === 200) {
            console.log(`Successfully invoked ${dailyBackupLambda} for date ${dateString}`);
            batchResponse.successDates.push(dateString);
          } else if (statusCode === 404) {
            console.log(`No data found for ${dailyBackupLambda} for date ${dateString}`);
            batchResponse.notFoundDates.push(dateString);
          } else {
            // unexpected status code
            console.log(`Unexpected status code: ${statusCode}`);
            batchResponse.errorDates.push(dateString);
          }
        } catch (error: any) {
          if (error instanceof TooManyRequestsException) {
            console.log(`Failed to invoke ${dailyBackupLambda} for date ${dateString}: TooManyRequestsException`);
            batchResponse.throttledDates.push(dateString);
          } else {
            console.log(`Error invoking ${dailyBackupLambda} with date ${dateString}: ${error}`);
            batchResponse.errorDates.push(dateString);
          }
          return 'error';
        }
      });
    }

    parallelLimit(tasks, 10, (err, data) => {
      if (err) {
        console.error(`Error executing batch tasks: ${err}`);
        resolve([]);
      } else {
        resolve(data);
      }
    });
  });

  return batchResponse;
};


export const handler = async (event: any, context: any) => {
  let totalFailures = 0;
  let strDate = event.queryStringParameters?.date || event?.body?.date || event?.date;

  let date;

  if (strDate) {
    date = moment(strDate).startOf('day'); // the provided date
  } else {
    date = moment().subtract(1, 'days').startOf('day'); // yesterday's date
  }

  const totalBatchResults: BatchProcessingResponse = {
    successDates: [],
    notFoundDates: [],
    throttledDates: [],
    errorDates: [],
  };

  while (totalFailures < 20) {

    const batchDates = [];
    // add 7 dates to the batch in the format YYYY-MM-DD
    for (let i = 0; i < 7; i++) {
      batchDates.push(date.format('YYYY-MM-DD'));
      date = date.subtract(1, 'days');
    }

    const batchResponse = await batchInvokeLambda(batchDates);
    console.log(`Batch completed with ${batchResponse.successDates.length} successes, 
      ${batchResponse.notFoundDates.length} not found, ${batchResponse.throttledDates.length} throttled and ${batchResponse.errorDates.length} errors`);

    totalBatchResults.successDates.push(...batchResponse.successDates);
    totalBatchResults.notFoundDates.push(...batchResponse.notFoundDates);
    totalBatchResults.throttledDates.push(...batchResponse.throttledDates);
    totalBatchResults.errorDates.push(...batchResponse.errorDates);

    totalFailures = totalFailures + batchResponse.errorDates.length + batchResponse.throttledDates.length + batchResponse.notFoundDates.length;
  }

  if (totalBatchResults.throttledDates.length < 0) {
    // sleep for one second
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Retrying throttled dates once');
    const retryBatchResponse = await batchInvokeLambda(totalBatchResults.throttledDates);
    console.log(`Retry batch completed with ${retryBatchResponse.successDates.length} successes, 
      ${retryBatchResponse.notFoundDates.length} not found, ${retryBatchResponse.throttledDates.length} throttled and ${retryBatchResponse.errorDates.length} errors`);
  }

  console.log(`Stopped after receiving ${totalFailures} failures.`);

  return getHttpResult(200, 'Success');
};