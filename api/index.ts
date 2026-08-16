import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server/index.js';

// Create the Express app
const app = createApp();

// Vercel serverless function handler
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}