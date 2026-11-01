const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

async function post(base, pathname, body, token = '') {
  const response = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })
  return response.json()
}

test('客户端开启搭子后会补同步本周本机记录', async t => {
  const { createApp } = require('./app')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'musclego-client-'))
  const server = createApp({ dataFile: path.join(directory, 'data.json'), allowDevLogin: true, wxAppId: '', wxSecret: '' })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  t.after(() => {
    server.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const config = require('../config')
  config.apiBaseUrl = base
  const memory = {}
  global.getApp = () => ({ globalData: { statusBarHeight: 20 } })
  global.wx = {
    getStorageSync: key => memory[key],
    setStorageSync: (key, value) => { memory[key] = value },
    removeStorageSync: key => { delete memory[key] },
    login: ({ success }) => setTimeout(() => success({ code: 'dev-code' }), 0),
    showToast: () => {},
    showModal: ({ success }) => success({ confirm: true, content: '晨练阿姨' }),
    request: options => {
      fetch(options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...options.header },
        body: JSON.stringify(options.data)
      }).then(async response => {
        options.success({ statusCode: response.status, data: await response.json() })
      }).catch(options.fail)
    }
  }

  const store = require('../utils/store')
  store.init()
  store.completeWorkout(new Date().getDay(), { mode: 'standard', elapsedSeconds: 180, completedExercises: 1, full: false })

  let definition
  global.Page = value => { definition = value }
  require('../pages/partners/partners')
  const page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(update) { Object.assign(this.data, update) }
  }

  page.onLoad({})
  assert.equal(page.data.showConsent, true)
  page.enablePartners()
  await new Promise(resolve => setTimeout(resolve, 150))

  assert.equal(page.data.loading, false)
  assert.equal(page.data.error, '')
  assert.equal(page.data.me.weekCount, 1)
  assert.equal(store.getState().settings.partnerBackfillDone, true)
  assert.ok(page.data.inviteCode)

  page.editNickname()
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(page.data.myNickname, '晨练阿姨')
  assert.match(page.onShareAppMessage().path, /invite=/)

  const bobLogin = await post(base, '/auth/login', { deviceId: 'device-bob-client-01' })
  await post(base, '/partners/accept', { inviteCode: page.data.inviteCode }, bobLogin.token)
  await page.loadPartners()
  assert.equal(page.data.partners.length, 1)
  const partner = page.data.partners[0]
  assert.equal(partner.actionKind, 'quick')

  await page.partnerAction({ currentTarget: { dataset: { id: partner.id, kind: 'quick' } } })
  assert.equal(page.data.partners[0].nudgedToday, true)
  assert.equal(page.data.partners[0].actionLabel, '已邀请，等回应')

  const bobInbox = await post(base, '/partners/overview', {}, bobLogin.token)
  assert.equal(bobInbox.incomingNudges.length, 1)
  await page.loadPartners()
  assert.equal(page.data.partners[0].nudgeStatus, 'pending')

  await post(base, '/partners/nudge/respond', { nudgeId: bobInbox.incomingNudges[0].id, status: 'training' }, bobLogin.token)
  await page.loadPartners()
  assert.equal(page.data.partners[0].actionLabel, '对方去练了')
})
