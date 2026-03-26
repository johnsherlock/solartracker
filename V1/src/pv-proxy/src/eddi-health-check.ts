import nodemailer from 'nodemailer';
import { getHttpResult } from './http-utils';
import { MyEnergiService } from './my-energi-service';

type SesSmtpConfig = {
  username: string;
  password: string;
  region: string;
};

const emailRecipient = process.env.EMAIL_RECIPIENT;
const sesSmtpConfig: SesSmtpConfig = {
  username: process.env.SES_SMTP_USERNAME!,
  password: process.env.SES_SMTP_PASSWORD!,
  region: process.env.AWS_REGION!,
};

const username = process.env.MYENERGI_USERNAME;
const password = process.env.MYENERGI_PASSWORD;
const myenergiAPIEndpoint = 'https://director.myenergi.net';

if (!username || !password) {
  throw new Error('MYENERGI_USERNAME and MYENERGI_PASSWORD must be set as environment variables.');
}

const myEnergiService = new MyEnergiService(myenergiAPIEndpoint);

const sendEmail = async (message: string) => {
  const transporter = nodemailer.createTransport({
    host: `email-smtp.${sesSmtpConfig.region}.amazonaws.com`,
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: sesSmtpConfig.username,
      pass: sesSmtpConfig.password,
    },
  });

  const mailOptions = {
    from: 'you@example.com',
    to: emailRecipient,
    subject: 'System Offline',
    text: 'The system is currently offline as no data is returned from the queried endpoint.',
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.response}`);
  } catch (error) {
    console.error(`Error sending email: ${error}`);
  }
};

export const handler = async (event: any, context: any) => {
  try {
    // get today's date in the format YYYY-MM-DD
    const date = new Date().toISOString().split('T')[0];

    const data = await myEnergiService.getEddiData(date, { serialNumber: username, password: password });

    // if no data is returned, send an email to the user
    if (!data || data.length === 0) {
      const message = `No data returned for ${date}. MyEnergi diverter may be offline or the API offline.`;
      console.log(message);
      // send an email to the user using nodemailer
      await sendEmail(message);
    }
  } catch (error) {
    const msg = `Error fetching data from MyEnergi API: ${error}`;
    return getHttpResult(500, msg);
  }
};


