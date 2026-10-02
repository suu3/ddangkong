/** 실시간 서버(Cloudflare Worker) 주소. 설정이 없으면 모든 게임이 로컬 모드로만 동작한다. */
export const getRealtimeUrl = (): string | null => {
  const url = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
  if (!url) return null;

  return url.replace(/\/+$/, '');
};

export const hasRealtimeConfig = () => Boolean(getRealtimeUrl());
