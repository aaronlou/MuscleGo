const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const WEEK_DAYS = 4

function todayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map(item => [item.type, item.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function weekStartKey(today = todayKey()) {
  const [year, month, day] = today.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

function initialData() {
  return { users: {}, sessions: {}, records: {}, invites: {}, partnerships: {}, cheers: {}, nudges: {}, completedSessions: {}, reminders: {} }
}

function createDataStore(file) {
  let data = initialData()
  if (fs.existsSync(file)) {
    try { data = { ...initialData(), ...JSON.parse(fs.readFileSync(file, 'utf8')) } } catch (error) { throw new Error(`数据文件无法解析: ${file}`) }
  }
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const temporary = `${file}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2))
    fs.renameSync(temporary, file)
  }
  return { data, save }
}

function send(res, status, body) {
  const content = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(content),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  })
  res.end(content)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1024 * 1024) reject(new Error('请求内容过大'))
    })
    req.on('end', () => {
      if (!body) return resolve({})
      try { resolve(JSON.parse(body)) }
      catch (error) { reject(new Error('请求内容不是有效 JSON')) }
    })
    req.on('error', reject)
  })
}

function publicUser(user) {
  return { id: user.id, nickname: user.nickname }
}

function makeNickname(id) {
  return `练友${id.slice(-4).toUpperCase()}`
}

async function wechatOpenId(code, appId, secret) {
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', appId)
  url.searchParams.set('secret', secret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok || data.errcode || !data.openid) throw new Error(data.errmsg || '微信登录失败')
  return data.openid
}

function createApp(options = {}) {
  const dataFile = options.dataFile || path.join(__dirname, 'data', 'musclego.json')
  const store = createDataStore(dataFile)
  const db = store.data
  const wxAppId = options.wxAppId || process.env.WX_APPID || ''
  const wxSecret = options.wxSecret || process.env.WX_SECRET || ''
  const allowDevLogin = options.allowDevLogin !== undefined ? options.allowDevLogin : process.env.ALLOW_DEV_LOGIN !== 'false'
  const openIdProvider = options.openIdProvider || wechatOpenId

  function save() { store.save() }
  function userFor(uid) { return db.users[uid] }

  function tokenFor(uid) {
    const token = crypto.randomBytes(24).toString('hex')
    db.sessions[token] = uid
    return token
  }

  function authenticated(req) {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    return token ? db.sessions[token] : null
  }

  function inviteFor(uid) {
    const found = Object.entries(db.invites).find(([, invite]) => invite.userId === uid)
    if (found) return found[0]
    let code
    do { code = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase() }
    while (db.invites[code])
    db.invites[code] = { userId: uid, createdAt: Date.now() }
    save()
    return code
  }

  function weekCount(uid) {
    const start = weekStartKey()
    const today = todayKey()
    return Object.keys(db.records[uid] || {}).filter(date => date >= start && date <= today).length
  }

  function todayCompleted(uid) { return !!((db.records[uid] || {})[todayKey()]) }

  function partnerIds(uid) { return db.partnerships[uid] || [] }

  async function login(body) {
    let uid
    let provider = 'development'
    if (wxAppId && wxSecret) {
      if (!body.code) throw Object.assign(new Error('缺少微信登录 code'), { status: 400 })
      const openid = await openIdProvider(body.code, wxAppId, wxSecret)
      uid = crypto.createHash('sha256').update(`${wxAppId}:${openid}`).digest('hex').slice(0, 24)
      provider = 'wechat'
    } else {
      if (!allowDevLogin) throw Object.assign(new Error('生产环境未配置微信登录'), { status: 503 })
      const deviceId = String(body.deviceId || '').trim()
      if (deviceId.length < 8 || deviceId.length > 128) throw Object.assign(new Error('开发登录缺少设备标识'), { status: 400 })
      uid = `dev-${crypto.createHash('sha256').update(deviceId).digest('hex').slice(0, 16)}`
    }
    if (!db.users[uid]) db.users[uid] = { id: uid, nickname: makeNickname(uid), createdAt: Date.now() }
    const token = tokenFor(uid)
    save()
    return { token, provider, user: publicUser(db.users[uid]) }
  }

  async function route(req, res) {
    if (req.method === 'OPTIONS') return send(res, 204, {})
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, weekDays: WEEK_DAYS })
    if (req.method !== 'POST') return send(res, 405, { message: '仅支持 POST 请求' })
    const pathname = new URL(req.url, 'http://localhost').pathname
    const body = await readBody(req)
    if (pathname === '/auth/login') return send(res, 200, await login(body))

    const uid = authenticated(req)
    if (!uid || !userFor(uid)) return send(res, 401, { message: '登录已失效，请重新进入' })

    if (pathname === '/records/complete') {
      const sessionId = String(body.sessionId || '').trim()
      const durationSeconds = Number(body.durationSeconds)
      if (!sessionId || sessionId.length > 120) throw Object.assign(new Error('训练编号无效'), { status: 400 })
      if (!Number.isFinite(durationSeconds) || durationSeconds < 60 || durationSeconds > 14400) throw Object.assign(new Error('训练时长无效'), { status: 400 })
      const done = db.completedSessions[uid] || {}
      if (done[sessionId]) return send(res, 200, { duplicated: true, weekCount: weekCount(uid) })
      done[sessionId] = true
      db.completedSessions[uid] = done
      const today = todayKey()
      const requestedDate = String(body.clientDate || '')
      const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= weekStartKey(today) && requestedDate <= today ? requestedDate : today
      const records = db.records[uid] || {}
      const previous = records[date] || { durationSeconds: 0, sessions: 0, completed: false }
      records[date] = {
        durationSeconds: previous.durationSeconds + Math.round(durationSeconds),
        sessions: previous.sessions + 1,
        completed: previous.completed || body.full === true,
        updatedAt: Date.now()
      }
      db.records[uid] = records
      save()
      return send(res, 200, { duplicated: false, weekCount: weekCount(uid) })
    }

    if (pathname === '/partners/overview') {
      const code = inviteFor(uid)
      const today = todayKey()
      const allNudges = Object.values(db.nudges || {})
      const partners = partnerIds(uid).filter(id => userFor(id)).map(id => {
        const outgoing = allNudges.filter(nudge => nudge.fromId === uid && nudge.toId === id && nudge.date === today).sort((a, b) => b.createdAt - a.createdAt)[0]
        return {
          ...publicUser(userFor(id)),
          weekCount: weekCount(id),
          todayCompleted: todayCompleted(id),
          cheeredToday: !!db.cheers[`${uid}:${id}:${today}`],
          nudgedToday: !!outgoing,
          nudgeStatus: outgoing ? outgoing.status : '',
          nudgeType: outgoing ? outgoing.type : ''
        }
      })
      const incomingNudges = allNudges.filter(nudge => nudge.toId === uid && nudge.date === today && nudge.status === 'pending' && partnerIds(uid).includes(nudge.fromId)).map(nudge => ({
        id: nudge.id,
        type: nudge.type,
        status: nudge.status,
        createdAt: nudge.createdAt,
        fromId: nudge.fromId,
        fromNickname: userFor(nudge.fromId) ? userFor(nudge.fromId).nickname : '锻炼搭子'
      }))
      return send(res, 200, {
        inviteCode: code,
        target: WEEK_DAYS,
        me: { ...publicUser(userFor(uid)), weekCount: weekCount(uid), todayCompleted: todayCompleted(uid) },
        partners,
        incomingNudges
      })
    }

    if (pathname === '/partners/accept') {
      const code = String(body.inviteCode || '').trim().toUpperCase()
      const invite = db.invites[code]
      if (!invite) throw Object.assign(new Error('邀请码不存在或已失效'), { status: 404 })
      const inviterId = invite.userId
      if (!userFor(inviterId)) throw Object.assign(new Error('邀请人不存在'), { status: 404 })
      if (inviterId === uid) throw Object.assign(new Error('不能添加自己为搭子'), { status: 400 })
      const mine = partnerIds(uid)
      const theirs = partnerIds(inviterId)
      if (!mine.includes(inviterId)) {
        db.partnerships[uid] = [...mine, inviterId]
        db.partnerships[inviterId] = [...theirs, uid]
        save()
      }
      return send(res, 200, { ok: true, partner: publicUser(userFor(inviterId)) })
    }

    if (pathname === '/partners/cheer') {
      const partnerId = String(body.partnerId || '')
      if (!partnerIds(uid).includes(partnerId)) throw Object.assign(new Error('你们还不是搭子'), { status: 403 })
      const key = `${uid}:${partnerId}:${todayKey()}`
      if (db.cheers[key]) throw Object.assign(new Error('今天已经鼓励过了'), { status: 429 })
      db.cheers[key] = Date.now()
      save()
      return send(res, 200, { ok: true, cheeredToday: true })
    }

    if (pathname === '/partners/nudge') {
      const partnerId = String(body.partnerId || '')
      const type = body.type === 'cheer' ? 'cheer' : 'quick'
      if (!partnerIds(uid).includes(partnerId)) throw Object.assign(new Error('你们还不是搭子'), { status: 403 })
      const today = todayKey()
      const existing = Object.values(db.nudges || {}).find(nudge => nudge.fromId === uid && nudge.toId === partnerId && nudge.date === today)
      if (existing) throw Object.assign(new Error('今天已经邀请过了'), { status: 429 })
      const id = crypto.randomBytes(9).toString('hex')
      const nudge = { id, fromId: uid, toId: partnerId, type, date: today, status: 'pending', createdAt: Date.now() }
      db.nudges[id] = nudge
      save()
      return send(res, 200, { nudge: { id, type, status: 'pending' } })
    }

    if (pathname === '/partners/nudge/respond') {
      const nudge = db.nudges[String(body.nudgeId || '')]
      const status = String(body.status || '')
      if (!nudge || nudge.toId !== uid) throw Object.assign(new Error('提醒不存在'), { status: 404 })
      if (nudge.date !== todayKey()) throw Object.assign(new Error('提醒已过期'), { status: 410 })
      if (!['training', 'rest'].includes(status)) throw Object.assign(new Error('回应状态无效'), { status: 400 })
      if (nudge.status !== 'pending') throw Object.assign(new Error('已经回应过了'), { status: 409 })
      nudge.status = status
      nudge.respondedAt = Date.now()
      save()
      return send(res, 200, { ok: true, status })
    }

    if (pathname === '/partners/remove') {
      const partnerId = String(body.partnerId || '')
      db.partnerships[uid] = partnerIds(uid).filter(id => id !== partnerId)
      db.partnerships[partnerId] = partnerIds(partnerId).filter(id => id !== uid)
      save()
      return send(res, 200, { ok: true })
    }

    if (pathname === '/reminders/schedule') {
      const time = String(body.time || '')
      if (!/^\d{2}:\d{2}$/.test(time)) throw Object.assign(new Error('提醒时间格式无效'), { status: 400 })
      db.reminders[uid] = { time, enabled: body.enabled !== false, updatedAt: Date.now() }
      save()
      return send(res, 200, { saved: true, scheduled: false, message: '提醒偏好已保存，微信订阅消息尚未配置' })
    }

    if (pathname === '/payments/membership') {
      throw Object.assign(new Error('微信支付尚未配置商户号，当前无法完成真实支付'), { status: 503 })
    }

    if (pathname === '/profile/nickname') {
      const nickname = Array.from(String(body.nickname || '').trim()).slice(0, 12).join('')
      if (Array.from(nickname).length < 2) throw Object.assign(new Error('昵称至少需要 2 个字符'), { status: 400 })
      if (/[\u0000-\u001f\u007f]/.test(nickname)) throw Object.assign(new Error('昵称包含无效字符'), { status: 400 })
      db.users[uid].nickname = nickname
      save()
      return send(res, 200, { user: publicUser(db.users[uid]) })
    }

    throw Object.assign(new Error('接口不存在'), { status: 404 })
  }

  return http.createServer((req, res) => {
    route(req, res).catch(error => {
      const status = error.status || 500
      if (status === 500) console.error(error)
      send(res, status, { message: status === 500 ? '服务暂时不可用' : error.message })
    })
  })
}

module.exports = { createApp, todayKey, weekStartKey }
