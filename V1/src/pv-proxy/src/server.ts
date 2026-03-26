import AxiosDigestAuth from '@mhoc/axios-digest-auth';
import cors from 'cors';
import express from 'express';
import { MyEnergiService } from './my-energi-service';

class Server {
  private app = express();
  private username: string;
  private password: string;

  private myEnergiAPIEndpoint = 'https://director.myenergi.net';

  private myEnergiService: MyEnergiService;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;

    this.myEnergiService = new MyEnergiService(this.myEnergiAPIEndpoint);

    this.app.use(cors());

    this.app.get('/minute-data', async (req: any, res: any): Promise<any> => {
      const date = req.query.date;
      return await this.fetchData(date, res);
    });

    this.app.listen(3001, () => {
      console.log('Server started on port 3001');
    });
  }

  private async fetchData(date: string, res: any): Promise<any> {
    console.log('Fetching data from API...');
    try {
      const data = await this.myEnergiService.getEddiData(date, { serialNumber: this.username, password: this.password });
      console.log('Data fetched successfully.');
      res.json(data);
    }
    catch(error) {
      console.log(error);
      res.status(500).json({ error });
    }
  }
}

const username = process.env.MYENERGI_USERNAME;
const password = process.env.MYENERGI_PASSWORD;

if (!username || !password) {
  throw('MYENERGI_USERNAME and MYENERGI_PASSWORD must be set as environment variables.');
} else {
  new Server(username, password);
}