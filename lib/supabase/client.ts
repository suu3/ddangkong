import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './env';

const config = getSupabaseConfig();

// 빌드 타임이나 설정이 없는 경우 에러를 던지지 않고,
// 대신 실제 클라이언트를 사용하는 시점에 문제가 발생하도록 하거나
// 가짜 클라이언트를 반환할 수 있게 합니다.
// 여기서는 createClient가 호출될 때 URL이 없으면 에러를 던지므로 조건부로 생성합니다.

export const supabase = config ? createClient(config.url, config.publishableKey) : (null as any); // 설정이 없을 경우 null (타입 단언)
