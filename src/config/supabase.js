import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';

// Polyfill global WebSocket for Node.js < 22 (required by @supabase/realtime-js)
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_KEY is missing. Supabase Authentication will not work properly.');
}

// Initializing the Supabase client with the URL and key
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder_key');

export default supabase;
