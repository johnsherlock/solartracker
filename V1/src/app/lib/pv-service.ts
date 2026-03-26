import axios from 'axios';
import { EddiData } from '../../shared/eddi-data';
import { mapEddiDataToMinutePVData } from '../../shared/energy-utils';
import { MinutePVData, RangeTotals } from '../../shared/pv-data';

export interface DailyEnergyUsageProps {
  data: MinutePVData[];
}

export const getPVDataForDate = async (formattedTargetDate: string): Promise<MinutePVData[]> => {
  console.log(`Retrieving per minute data for ${formattedTargetDate}`);
  const url = `https://jmcjm1731b.execute-api.eu-west-1.amazonaws.com/prod/minute-data?date=${formattedTargetDate}`;
  try {
    const response = await axios.get(url);
    const data = await Promise.resolve(response.data as EddiData[]);
    return data.map(mapEddiDataToMinutePVData);
  } catch (error) {
    console.log(`Error retrieving data for ${formattedTargetDate}`, error);
    document.body.style.cursor = 'auto';
    return [];
  };
};

export const getPVTotalsForRange = async (startDate: string, endDate: string): Promise<RangeTotals> => {
  try {
    const url = `https://jmcjm1731b.execute-api.eu-west-1.amazonaws.com/prod/aggregate-historical-data?serialNumber=21494842&startDate=${startDate}&endDate=${endDate}`;
    console.log(`Retrieving PV summary data for range ${startDate} - ${endDate}`, url);
    const response = await axios.get(url);
    return await Promise.resolve(response.data as RangeTotals);
  } catch (error) {
    console.log('Error retrieving totals for range', error);
    document.body.style.cursor = 'auto';
    return { rawData: [] };
  };
};