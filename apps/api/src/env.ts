import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load environment variables from apps/api/.env if present.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../.env") });
