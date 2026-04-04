/**
 * Raw record shape returned by the MyEnergi API.
 *
 * All date/time fields (yr, mon, dom, hr, min) are UTC.
 * hr and min are omitted when their value is 0.
 * All energy fields are in Joules and omitted when their value is 0.
 *
 * Field reference:
 *   imp    – Imported energy from the grid (J)
 *   gep    – Generated positive: solar panel output above the device threshold (J)
 *   gen    – Generated: small residual reading present at night / low light (J)
 *            Not used for generatedKwh — treated as inverter noise below threshold
 *   exp    – Exported energy to the grid (J)
 *   h1d    – Heater-1 Diverted: energy diverted from solar to immersion (J)
 *   h1b    – Heater-1 Boost: grid energy sent to immersion via manual boost (J)
 *   pect1  – Power of CT clamp 1 (J)
 *   pect2  – Power of CT clamp 2 (J)
 *   nect1  – Negative CT clamp 1 (J)
 *   v1     – Supply voltage (centi-volts)
 *   frq    – Supply frequency (centi-Hertz)
 *   hsk    – Device housekeeping / status value
 *   dow    – UTC day of week
 */
export interface EddiRecord {
  yr: number;
  mon: number;
  dom: number;
  dow?: string;
  hr?: number;   // UTC hour; absent when 0
  min?: number;  // UTC minute; absent when 0
  imp?: number;
  gep?: number;
  gen?: number;
  exp?: number;
  h1d?: number;
  h1b?: number;
  pect1?: number;
  pect2?: number;
  nect1?: number;
  v1?: number;
  frq?: number;
  hsk?: number;
}

/**
 * Raw response envelope from the MyEnergi API.
 * The records array is keyed by `U` + the device serial number.
 */
export type EddiDayResponse = Record<string, EddiRecord[]>;

export type MyEnergiCredentials = {
  serialNumber: string;
  password: string;
};
