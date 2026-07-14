/**
 * 忆算 - Service Worker
 * 实现离线缓存，支持 PWA 离线运行
 * 缓存策略：安装时预缓存所有静态资源
 */

// 缓存名称（版本号便于更新）
const CACHE_NAME = 'yisuan-v1';

// 需要预缓存的静态资源列表
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json'
];

// ========== 安装事件：预缓存所有静态资源 ==========
self.addEventListener('install', (event) => {
  console.log('[SW] 正在安装...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 预缓存静态资源');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] 安装完成');
        // 强制激活，不等待旧 SW 释放
        return self.skipWaiting();
      })
  );
});

// ========== 激活事件：清理旧版本缓存 ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] 正在激活...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] 删除旧缓存:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] 激活完成');
      // 立即接管所有页面
      return self.clients.claim();
    })
  );
});

// ========== 请求事件：缓存优先策略 ==========
self.addEventListener('fetch', (event) => {
  // 仅处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // 缓存命中，直接返回
        return cachedResponse;
      }
      // 缓存未命中，发起网络请求并动态缓存
      return fetch(event.request).then((response) => {
        // 只缓存成功的响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        // 克隆响应（响应流只能读取一次）
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // 网络请求失败且无缓存，返回离线页面
        // 对于导航请求可返回首页；其他请求静默失败
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 408 });
      });
    })
  );
});
