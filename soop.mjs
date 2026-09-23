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
/** 공개 방송국의 읽기 전용 API. 방송국 기본 API와 현재 방송 상태 API를 상호 보완해 조회한다. */
export async function lookupSoopProfile(input, { fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const bjId = parseSoopId(input);
  let unreachable = false;
  let verifiedPhoto = '';
  const fallbackPhoto = `https://profile.img.sooplive.com/LOGO/${bjId.slice(0, 2)}/${bjId}/${bjId}.jpg`;

  // SOOP 공개 응답은 API별로 서로 다른 필드를 담는다. 응답 크기를 제한한다.
  const readJson = async (url) => {
    const res = await fetchImpl(url, {
      method: 'GET', headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs), redirect: 'error'
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`SOOP returned ${res.status}`);
    const len = Number(res.headers?.get?.('content-length') || 0);
    if (len > 524288) throw new Error('SOOP response too large');
    const raw = await res.text();
    if (raw.length > 524288) throw new Error('SOOP response too large');
    return JSON.parse(raw);
  };
  const makeResult = (nickname, image = '') => ({
    bjId, nickname: nickname.trim().slice(0, 60),
    photoUrl: image || verifiedPhoto || fallbackPhoto,
    photoVerified: Boolean(image || verifiedPhoto), soopUrl: canonicalSoopUrl(bjId)
  });

  // 방송국 페이지 정보: 주로 프로필 사진 및 방송국 레이아웃 정보를 제공한다.
  for (const domain of domains) {
    let body;
    try {
      body = await readJson(`https://chapi.${domain}/api/${encodeURIComponent(bjId)}/station`);
    } catch (err) {
      console.warn(`[SOOP] chapi.${domain} lookup failed: ${err?.message || "request failed"}`);
      unreachable = true; continue;
    }
    if (!body) continue;
    const station = body?.station || body?.data?.station || body?.data || {};
    const image = [body?.profile_image, station?.profile_image, body?.data?.profile_image,
      body?.broad?.profile_image, body?.user?.profile_image,
      body?.data?.broad?.profile_image, body?.data?.user?.profile_image,
      station?.profile_img, station?.profileImage, station?.user_profile_image,
      station?.station_logo, body?.station_image, body?.logo_url]
      .map(safeProfile).find(Boolean) || '';
    if (image) verifiedPhoto = image;
    const nickname = [
      station.user_nick, station.userNick, station.nickname,
      station?.broad?.user_nick, body?.broad?.user_nick, body?.broad?.userNick,
      body?.user?.user_nick, body?.user?.userNick,
      body?.data?.broad?.user_nick, body?.data?.user?.user_nick,
      body?.user_nick, body?.nickname
    ].find(v => typeof v === 'string' && v.trim());
    if (nickname) return makeResult(nickname, image);
  }

  // chapi.station에는 닉네임이 없을 수 있다. 실제 공개 방송 상태 API의 DATA.user_nick을 별도로 확인한다.
  // URL 형식: https://st.sooplive.com/api/get_station_status.php?szBjId=danchu17
  try {
    const status = await readJson(`https://st.sooplive.com/api/get_station_status.php?szBjId=${encodeURIComponent(bjId)}`);
    const info = status?.DATA;
    const found = status && (status.RESULT === 1 || status.RESULT === '1');
    if (found && info && (!info.user_id || String(info.user_id).toLowerCase() === bjId)) {
      const nickname = [info.user_nick, info.station_name].find(v => typeof v === 'string' && v.trim());
      if (nickname) return makeResult(nickname, safeProfile(info.profile_image));
    }
  } catch (err) {
    console.warn(`[SOOP] st.sooplive.com lookup failed: ${err?.message || "request failed"}`);
    unreachable = true;
  }

  if (unreachable) throw new SoopLookupError('SOOP 공개 API 연결 또는 응답 처리에 실패했습니다. 잠시 뒤 재시도하거나 이름과 프로필을 직접 입력해 주세요.', 502);
  throw new SoopLookupError('방송국 정보를 찾을 수 없습니다. 방송국 주소를 확인하거나 직접 입력해 주세요.', 404);
}
