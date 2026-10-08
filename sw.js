// Service worker: guarda o app no aparelho para abrir sem internet.
// Estratégia "usa o que está guardado e atualiza em segundo plano": a versão nova aparece na abertura seguinte.
// Mudou algum arquivo? Aumente VERSAO para limpar o que ficou guardado.
const VERSAO = "v1";
const CACHE = `simulados-4a-3t-${VERSAO}`;
const ARQUIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/api.js",
  "js/motor.js",
  "js/cartas.js",
  "js/criatura.js",
  "js/quiz.js",
  "js/util.js",
  "conteudo/catalogo.json",
  "conteudo/matematica-p1-1.json",
  "conteudo/matematica-p1-2.json",
  "conteudo/matematica-p1-3.json",
  "conteudo/matematica-multidisciplinar-2-1.json",
  "conteudo/matematica-multidisciplinar-2-2.json",
  "conteudo/matematica-multidisciplinar-2-3.json",
  "conteudo/portugues-p1-1.json",
  "conteudo/portugues-p1-2.json",
  "conteudo/portugues-p1-3.json",
  "conteudo/gramatica-multidisciplinar-2-1.json",
  "conteudo/gramatica-multidisciplinar-2-2.json",
  "conteudo/gramatica-multidisciplinar-2-3.json",
  "conteudo/ciencias-p1-1.json",
  "conteudo/ciencias-p1-2.json",
  "conteudo/ciencias-p1-3.json",
  "conteudo/ciencias-multidisciplinar-1-1.json",
  "conteudo/ciencias-multidisciplinar-1-2.json",
  "conteudo/ciencias-multidisciplinar-1-3.json",
  "conteudo/geografia-p1-1.json",
  "conteudo/geografia-p1-2.json",
  "conteudo/geografia-p1-3.json",
  "conteudo/geografia-multidisciplinar-1-1.json",
  "conteudo/geografia-multidisciplinar-1-2.json",
  "conteudo/geografia-multidisciplinar-1-3.json",
  "conteudo/historia-p1-1.json",
  "conteudo/historia-p1-2.json",
  "conteudo/historia-p1-3.json",
  "conteudo/historia-multidisciplinar-3-1.json",
  "conteudo/historia-multidisciplinar-3-2.json",
  "conteudo/historia-multidisciplinar-3-3.json",
  "conteudo/bilingue-p1-1.json",
  "conteudo/bilingue-p1-2.json",
  "conteudo/bilingue-p1-3.json",
  "conteudo/bilingue-multidisciplinar-3-1.json",
  "conteudo/bilingue-multidisciplinar-3-2.json",
  "conteudo/bilingue-multidisciplinar-3-3.json",
  "img/icone.svg",
  "img/icone-192.png",
  "img/icone-512.png",
  "img/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const guardado = await cache.match(req, { ignoreSearch: true });
      const rede = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
      return guardado || (await rede) || new Response("Sem internet e este arquivo ainda não foi guardado.", { status: 503 });
    }),
  );
});
