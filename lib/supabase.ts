import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendErrorToGoogleChat } from '@/lib/google-chat';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 환경변수 누락');
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: createSupabaseFetchWithAlert(supabaseUrl),
    },
  });
  return supabase;
}

function createSupabaseFetchWithAlert(baseUrl: string) {
  const globalFetch = globalThis.fetch.bind(globalThis);

  return async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
    const response = await globalFetch(input, init);

    const requestUrl =
      typeof input === 'string' ? input : 'href' in input ? input.href : input.toString();

    if (!response.ok) {
      await trackSupabaseResponse(response.clone(), requestUrl, init?.method ?? 'GET', baseUrl);
    }

    return response;
  };
}

async function trackSupabaseResponse(
  response: Response,
  requestUrl: string,
  method: string,
  baseUrl: string
) {
  if (!requestUrl.startsWith(baseUrl)) return;

  if (response.ok) return;

  let errorMessage = `HTTP Status: ${response.status} ${response.statusText}`;

  try {
    const textBody = await response.text();

    if (textBody) {
      try {
        const payload = JSON.parse(textBody);
        const errorPayload =
          payload?.error ?? payload?.error_description ?? payload?.message ?? payload?.msg;

        if (errorPayload) {
          errorMessage =
            typeof errorPayload === 'object'
              ? JSON.stringify(errorPayload, null, 2)
              : String(errorPayload);
        } else {
          errorMessage = textBody.slice(0, 1000);
        }
      } catch (e) {
        errorMessage += `\nBody: ${textBody.slice(0, 500)}`; // 너무 길면 자름
      }
    }

    const context = buildContextForRequest(requestUrl, method);

    await sendErrorToGoogleChat(errorMessage, context);
  } catch (trackingError) {
    console.error('Supabase error tracking failed:', trackingError);
  }
}

function buildContextForRequest(requestUrl: string, method: string) {
  try {
    const urlObj = new URL(requestUrl);
    // 쿼리 파라미터까지 포함하면 너무 지저분하므로 Path만
    return `[Supabase] ${method.toUpperCase()} ${urlObj.pathname}`;
  } catch (error) {
    return `[Supabase] ${method.toUpperCase()} ...`;
  }
}
