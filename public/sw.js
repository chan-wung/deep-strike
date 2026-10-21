/**
 * 오프라인용 서비스 워커. 빌드 파일 이름에 해시가 붙어 미리 목록을 만들 수 없으므로,
 * 같은 출처의 GET 요청을 "캐시를 먼저 보여 주고 뒤에서 새로 받아 갱신"(stale-while-revalidate)한다.
 * 한 번 온라인으로 열어 보면 그 뒤로는 오프라인에서도 실행된다. 새 버전은 다음 실행 때 반영된다.
 */
const CACHE = 'deep-strike-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      const fresh = fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || (request.mode === 'navigate' ? cache.match('./') : null) || Response.error();
    }),
  );
});
