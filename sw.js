'use strict';
/* 深空突袭 Service Worker(v4.5.3,零依赖手写)
 * cache-first app shell:预缓存全部运行文件,安装后可完全离线游玩。
 * 版本化缓存名:发版后 activate 自动清理旧缓存。 */
// 缓存名由运行文件 js/version.js 动态派生:发版只改版本文件,SW 自动切换新缓存
let CACHE = 'deep-strike-runtime';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/version.js',
  './js/audio.js',
  './js/entities.js',
  './js/sprites.js',
  './js/upgrades.js',
  './js/achievements.js',
  './js/tasks.js',
  './js/shop.js',
  './js/game.js',
  './js/modes.js',
  './js/waves.js',
  './js/hud.js',
  './js/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('./js/version.js')
      .then((r) => r.text())
      .then((t) => { const m = t.match(/v[\d.]+/); if (m) CACHE = 'deep-strike-' + m[0]; })
      .then(() => caches.open(CACHE))
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
