//pre
const env = {
  PASSWORD:                       typeof(PASSWORD)!=='undefined'?PASSWORD:
  'mypassword'                    ,
  PASSWORD_REQUIRE:               typeof(PASSWORD_REQUIRE)!=='undefined'?parseBoolean(PASSWORD_REQUIRE):
  true                            ,
  HOST_WHITELIST:                 typeof(HOST_WHITELIST)!=='undefined'?HOST_WHITELIST.split(',').map(s=>s.trim()).filter(s=>s):
  ['coderxi.com', 'coderxi.cn']   ,
  KEY_LENGTH:                     typeof(KEY_LENGTH)!=='undefined'?parseInt(KEY_LENGTH):
  6                               ,
  KEY_ALIVE_SECONDS:              typeof(KEY_ALIVE_SECONDS)!=='undefined'?parseInt(KEY_ALIVE_SECONDS):
  1800                            ,
  KEY_REMOVE:                     typeof(KEY_REMOVE)!=='undefined'?parseBoolean(KEY_REMOVE):
  true
}
const kv = LINKS;

//get
const getUrl = async (key) => {
  const value = await kv.get(key)
  if (!value) {
    return null
  }
  const [saveTime, url] = value.split('|',2)
  const isAlive = (Date.now() - saveTime) / 1000 < env.KEY_ALIVE_SECONDS
  return isAlive ? url : null
}

//save
const saveUrl = async (key, url, password) => {
  assert(url, 'url is required')
  assert(urlAvailable(url), `url {${url}} is not valid`)

  env.PASSWORD_REQUIRE && assert(password, 'password is required')
  const passwordCorrect = password === env.PASSWORD
  password && assert(passwordCorrect, 'password wrong')

  const keyIsRandom = !key
  key = keyIsRandom ? await ensureRandomKey() : key
  const value = [Date.now().toString(), url].join('|')
  
  const putOptions = null

  if (!passwordCorrect) {
    putOptions = env.KEY_REMOVE ? { expirationTtl: env.KEY_ALIVE_SECONDS } : null
    const host = new URL(url).host
    assert(hostInWhitelist(host), `host {${host}} is not in whitelist`)
    assert(keyIsRandom && !(await getUrl(key)), `key {${key}} already exists`)
    assert(key.length === env.KEY_LENGTH, `key {${key}} length is not ${env.KEY_LENGTH}`)
  }
  return await kv.put(key, value, putOptions), key
}

//worker
const handleRequest = async (request) => {
  const url = new URL(request.url)
  const path = url.pathname
  if (path === '/' && request.method === 'GET') {
    return responseHtml(HTML_INDEX)
  } else if (path === '/' && request.method === 'POST') {
    const { key, url, password } = await request.json()
    try {
      return responseJson({ key: await saveUrl(key, url, password) })
    } catch (e) {
      return responseJson({ error: e.message })
    }
  } else {
    const key = path.slice(1)
    const url = await getUrl(key)
    return url ? Response.redirect(url, 302) : responseHtml(HTML_404.trim())
  }
}
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})

//utils
function isDefined(o) { return typeof(o) !== "undefined" }
function parseBoolean(s) { return s === 'true' }
function urlAvailable(url) { return /^https?:\/\/(?:.*@)?[\w-]+(?:\.[\w-]+)*(?:[_\-.,~!*:#()\w\/?%&=]*)?$/.test(url) }
function hostInWhitelist (host) { return env.HOST_WHITELIST.some((h) => host == h || host.endsWith('.' + h)) }
function responseJson (obj) { return new Response(JSON.stringify(obj), {headers: {'Content-Type': 'application/json'}}) }
function responseHtml (html) { return new Response(html, {headers: {'Content-Type': 'text/html'}}) }
function assert(condition, message) { if (!condition) throw new Error(message) }
//key utils
function randomKey (length) {
  const $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'
  return Array.from({ length }, () => $chars.charAt(Math.floor(Math.random() * $chars.length))).join('')
}
async function ensureRandomKey() {
  let [ key, len, times ] = [ null, env.KEY_LENGTH, 0 ]
  do {
    key = randomKey(len);
    if (times++ > 3 && len++ > env.KEY_LENGTH + 3) { 
      throw new Error('too many random key generation attempts')}
  } while (await getUrl(key))
  return key
}