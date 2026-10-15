/**
 * Loads env files for CLI scripts. Import this first: imports run before the
 * rest of a module's body, so loading here (rather than calling dotenv inline)
 * happens before `db/client` pulls in `dotenv/config` and reads `.env`.
 *
 * Precedence: explicitly passed variables > .env.local > .env.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config();
