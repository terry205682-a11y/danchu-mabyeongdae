/** SOOP 공개 방송국 정보 조회. 인증되지 않은 외부 URL에는 요청하지 않는다. */
export class SoopLookupError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

const ID = /^[a-z0-9_]{3,20}$/i;
const SOOP_HOSTS = new Set([
  'sooplive.com', 'www.sooplive.com', 'sooplive.co.kr', 'www.sooplive.co.kr',
  'bj.afreecatv.com', 'bj.sooplive.com', 'bj.sooplive.co.kr',
  'play.sooplive.com', 'play.sooplive.co.kr', 'ch.sooplive.com',
  'ch.sooplive.co.kr', 'play.afreecatv.com', 'www.afreecatv.com',
  'afreecatv.com', 'ch.afreecatv.com'
]);

export function parseSoopId(input) {
  const value = String(input ?? '').trim();
  if (!value || value.length > 500) throw new SoopLookupError('SOOP 방송국 링크를 입력해 주세요.', 400);
  if (ID.test(value)) return value.toLowerCase(); // BJ 아이디만 입력해도 허용
  let url;
  try { url = new URL(value); } catch { throw new SoopLookupError('SOOP 방송국 주소 또는 BJ 아이디를 확인해 주세요.', 400); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new SoopLookupError('http(s) 방송국 주소만 지원합니다.', 400);
  if (!SOOP_HOSTS.has(url.hostname.toLowerCase())) throw new SoopLookupError('SOOP 방송국 주소만 조회할 수 있습니다.', 400);
  const parts = url.pathname.split('/').filter(Boolean);
  let userId;
  if (parts[0] === 'station' && parts.length === 2) userId = parts[1];
  else if (parts.length === 1 && !['station', 'player', 'vod', 'search', 'login'].includes(parts[0])) userId = parts[0];
  else userId = url.searchParams.get('bj_id') || url.searchParams.get('bjid');
  if (!userId || !ID.test(userId)) throw new SoopLookupError('방송국 주소에서 BJ 아이디를 찾을 수 없습니다.', 400);
  return userId.toLowerCase();
}

export const canonicalSoopUrl = userId => `https://www.sooplive.com/station/${encodeURIComponent(userId)}`;

/** Accept only known public SOOP image hosts. A URL returned by a third party must not become an SSRF target. */
export function safeSoopImageUrl(raw) {
  if (raw && typeof raw === 'object') raw = raw.url || raw.src || raw.image_url || raw.profile_image || '';
  if (typeof raw !== 'string' || !raw.trim()) return '';
  let value = raw.trim();
  if (value.startsWith('//')) value = `https:${value}`;
  if (value.startsWith('/LOGO/')) value = `https://profile.img.sooplive.com${value}`;
  let url;
  try { url = new URL(value); } catch { return ''; }
  if (url.protocol !== 'https:') return '';
  if (!/(^|\.)(sooplive\.(com|co\.kr)|afreecatv\.com)$/.test(url.hostname.toLowerCase())) return '';
  if (url.username || url.password || url.port || url.toString().length > 500) return '';
  return url.toString();
}
const safeProfile = safeSoopImageUrl;

const domains = ['sooplive.com', 'sooplive.co.kr'];
/** 공개 방송국의 읽기 전용 API. 응답 변경/차단 시 수동 입력 가능. fetchImpl 주입으로 외부망 없이 테스트. */
export async function lookupSoopProfile(input, { fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const bjId = parseSoopId(input);
  let unreachable = false;
  for (const domain of domains) {
    const endpoint = `https://chapi.${domain}/api/${encodeURIComponent(bjId)}/station`;
    let res;
    try {
      res = await fetchImpl(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error'
      });
    } catch { unreachable = true; continue; }
    if (res.status === 404) continue;
    if (!res.ok) { unreachable = true; continue; }
    try {
      const len = Number(res.headers?.get?.('content-length') || 0);
      if (len > 524288) { unreachable = true; continue; }
      const text = await res.text();
      if (text.length > 524288) { unreachable = true; continue; }
      const body = JSON.parse(text);
      const station = body?.station || body?.data?.station || body?.data || {};
      // Never silently use BJ ID as a nickname. In that case require manual input.
      const nickname = [station.user_nick, station.userNick, station.nickname, body?.user_nick, body?.nickname]
        .find(v => typeof v === 'string' && v.trim());
      if (!nickname) continue;
      const image = [body?.profile_image, station?.profile_image, body?.data?.profile_image,
        station?.profile_img, station?.profileImage, station?.user_profile_image, station?.station_logo,
        body?.station_image, body?.logo_url]
        .map(safeProfile).find(Boolean) || '';
      // Known CDN path is a candidate only, never described as a verified photo.
      const fallback = `https://profile.img.sooplive.com/LOGO/${bjId.slice(0, 2)}/${bjId}/${bjId}.jpg`;
      return { bjId, nickname:nickname.trim().slice(0, 60), photoUrl:image || fallback,
        photoVerified:Boolean(image), soopUrl: canonicalSoopUrl(bjId) };
    } catch { unreachable = true; }
  }
  if (unreachable) throw new SoopLookupError('SOOP 방송국에 연결할 수 없습니다. 잠시 뒤 재시도하거나 이름과 프로필을 직접 입력해 주세요.', 502);
  throw new SoopLookupError('방송국 정보를 찾을 수 없습니다. 방송국 주소를 확인하거나 직접 입력해 주세요.', 404);
}
