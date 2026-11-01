const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createApp, weekStartKey, todayKey } = require('./app')

async function start(dataFile) {
  const server = createApp({ dataFile, allowDevLogin: true, wxAppId: '', wxSecret: '' })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  return { server, base }
}

async function post(base, pathname, body = {}, token = '') {
  const response = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })
  return { status: response.status, body: await response.json() }
}

async function login(base, deviceId) {
  const result = await post(base, '/auth/login', { deviceId })
  assert.equal(result.status, 200)
  assert.ok(result.body.token)
  return result.body.token
}

test('周日期计算使用周一开始', () => {
  assert.equal(weekStartKey('2026-10-27'), '2026-10-26')
  assert.equal(weekStartKey('2026-11-01'), '2026-10-26')
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/)
})

test('训练同步与熟人搭子完整闭环', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'musclego-test-'))
  const dataFile = path.join(directory, 'data.json')
  const { server, base } = await start(dataFile)
  t.after(() => {
    server.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const alice = await login(base, 'device-alice-0001')
  const bob = await login(base, 'device-bob-0001')
  const carol = await login(base, 'device-carol-0001')
  const dave = await login(base, 'device-dave-0001')
  const erin = await login(base, 'device-erin-0001')

  assert.equal((await post(base, '/partners/overview')).status, 401)

  const firstRecord = await post(base, '/records/complete', { sessionId: 'alice-session-1', durationSeconds: 120, full: false }, alice)
  assert.equal(firstRecord.status, 200)
  assert.equal(firstRecord.body.weekCount, 1)
  assert.equal((await post(base, '/records/complete', { sessionId: 'alice-session-1', durationSeconds: 120, full: false }, alice)).body.duplicated, true)
  assert.equal((await post(base, '/records/complete', { sessionId: 'alice-session-2', durationSeconds: 300, full: true }, alice)).body.weekCount, 1)

  const aliceOverview = await post(base, '/partners/overview', {}, alice)
  assert.equal(aliceOverview.status, 200)
  assert.equal(aliceOverview.body.me.weekCount, 1)
  assert.equal(aliceOverview.body.me.todayCompleted, true)
  assert.equal(aliceOverview.body.partners.length, 0)
  assert.ok(aliceOverview.body.inviteCode)
  assert.equal(aliceOverview.body.target, 4)

  const reminder = await post(base, '/reminders/schedule', { time: '08:30', enabled: true }, alice)
  assert.equal(reminder.status, 200)
  assert.equal(reminder.body.scheduled, false)
  const payment = await post(base, '/payments/membership', { productId: 'test' }, alice)
  assert.equal(payment.status, 503)
  assert.match(payment.body.message, /微信支付/)

  const backfillDate = weekStartKey()
  const backfill = await post(base, '/records/complete', { sessionId: `local-${backfillDate}`, clientDate: backfillDate, durationSeconds: 180, full: false }, carol)
  assert.equal(backfill.status, 200)
  assert.equal((await post(base, '/partners/overview', {}, carol)).body.me.weekCount, 1)

  assert.equal((await post(base, '/profile/nickname', { nickname: '晨练阿姨' }, alice)).status, 200)
  assert.equal((await post(base, '/profile/nickname', { nickname: '老张' }, bob)).status, 200)

  const bobOverview = await post(base, '/partners/overview', {}, bob)
  const accept = await post(base, '/partners/accept', { inviteCode: aliceOverview.body.inviteCode }, bob)
  assert.equal(accept.status, 200)

  const aliceAfterAccept = await post(base, '/partners/overview', {}, alice)
  assert.equal(aliceAfterAccept.body.partners.length, 1)
  assert.equal(aliceAfterAccept.body.partners[0].nickname, '老张')

  const cheer = await post(base, '/partners/cheer', { partnerId: bobOverview.body.me.id }, alice)
  assert.equal(cheer.status, 200)
  const repeatedCheer = await post(base, '/partners/cheer', { partnerId: bobOverview.body.me.id }, alice)
  assert.equal(repeatedCheer.status, 429)
  assert.equal((await post(base, '/partners/overview', {}, alice)).body.partners[0].cheeredToday, true)

  const nudge = await post(base, '/partners/nudge', { partnerId: bobOverview.body.me.id, type: 'quick' }, alice)
  assert.equal(nudge.status, 200)
  assert.equal((await post(base, '/partners/nudge', { partnerId: bobOverview.body.me.id, type: 'quick' }, alice)).status, 429)
  const bobInbox = await post(base, '/partners/overview', {}, bob)
  assert.equal(bobInbox.body.incomingNudges.length, 1)
  assert.equal(bobInbox.body.incomingNudges[0].fromNickname, '晨练阿姨')
  assert.equal((await post(base, '/partners/nudge/respond', { nudgeId: nudge.body.nudge.id, status: 'training' }, carol)).status, 404)
  assert.equal((await post(base, '/partners/nudge/respond', { nudgeId: nudge.body.nudge.id, status: 'training' }, bob)).status, 200)
  assert.equal((await post(base, '/partners/nudge/respond', { nudgeId: nudge.body.nudge.id, status: 'rest' }, bob)).status, 409)
  assert.equal((await post(base, '/partners/overview', {}, alice)).body.partners[0].nudgeStatus, 'training')

  await post(base, '/records/complete', { sessionId: 'bob-session-1', durationSeconds: 90, full: false }, bob)
  assert.equal((await post(base, '/partners/overview', {}, alice)).body.partners[0].weekCount, 1)

  const carolCode = (await post(base, '/partners/overview', {}, carol)).body.inviteCode
  const daveCode = (await post(base, '/partners/overview', {}, dave)).body.inviteCode
  const erinCode = (await post(base, '/partners/overview', {}, erin)).body.inviteCode
  assert.equal((await post(base, '/partners/accept', { inviteCode: carolCode }, alice)).status, 200)
  assert.equal((await post(base, '/partners/accept', { inviteCode: daveCode }, alice)).status, 200)
  assert.equal((await post(base, '/partners/accept', { inviteCode: erinCode }, alice)).status, 200)
  assert.equal((await post(base, '/partners/overview', {}, alice)).body.partners.length, 4)
  assert.equal((await post(base, '/partners/accept', { inviteCode: aliceOverview.body.inviteCode }, alice)).status, 400)

  const remove = await post(base, '/partners/remove', { partnerId: bobOverview.body.me.id }, alice)
  assert.equal(remove.status, 200)
  assert.equal((await post(base, '/partners/overview', {}, bob)).body.partners.length, 0)

  server.close()
  const restarted = await start(dataFile)
  t.after(() => restarted.server.close())
  const persisted = await post(restarted.base, '/partners/overview', {}, alice)
  assert.equal(persisted.status, 200)
  assert.equal(persisted.body.partners.length, 3)
})
