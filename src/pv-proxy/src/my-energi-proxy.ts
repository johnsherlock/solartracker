import { MyEnergiService } from './my-energi-service';

const username = process.env.MYENERGI_USERNAME;
const password = process.env.MYENERGI_PASSWORD;
const myenergiAPIEndpoint = 'https://director.myenergi.net';

if (!username || !password) {
  throw new Error('MYENERGI_USERNAME and MYENERGI_PASSWORD must be set as environment variables.');
}

const myEnergiService = new MyEnergiService(myenergiAPIEndpoint);

export async function handler(event: any, context: any) {
  try {
    const date = event.queryStringParameters.date;

    const data = await myEnergiService.getEddiData(date, { serialNumber: username, password: password });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error }) };
  }
}
