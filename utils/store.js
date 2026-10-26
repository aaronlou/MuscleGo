const { dateKey, getStreak } = require('./date')
const { getWorkout } = require('./data')
const KEY = 'musclego_state_v1'
const defaults = { records: {}, settings: { reminder: false, reminderTime: '08:30', largeText: false }, member: null }

function init() {
  const saved = wx.getStorageSync(KEY)
  if (!saved) wx.setStorageSync(KEY, defaults)
}

function getState() {
  return { ...defaults, ...wx.getStorageSync(KEY) }
}

function saveState(state) {
  wx.setStorageSync(KEY, state)
  return state
}

function saveSettings(settings) {
  const state = getState()
  state.settings = { ...state.settings, ...settings }
  return saveState(state)
}

function saveMember(member) {
  const state = getState()
  state.member = member
  return saveState(state)
}

function completeWorkout(dayIndex) {
  const state = getState()
  const key = dateKey()
  const workout = getWorkout(dayIndex)
  state.records = { ...state.records, [key]: { date: key, minutes: workout.minutes, title: workout.title, exercises: workout.exercises.length, completedAt: Date.now() } }
  saveState(state)
  return getSummary()
}

function getSummary() {
  const { records } = getState()
  const values = Object.values(records)
  return {
    streak: getStreak(records),
    total: values.length,
    minutes: values.reduce((sum, item) => sum + (item.minutes || 0), 0)
  }
}

module.exports = { init, getState, saveSettings, saveMember, completeWorkout, getSummary }
