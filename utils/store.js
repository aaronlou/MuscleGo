const { dateKey, fromKey, getStreak } = require('./date')
const { getWorkout } = require('./data')
const KEY = 'musclego_state_v1'
const defaults = { records: {}, settings: { reminder: false, reminderTime: '08:30', largeText: false, partnerSharing: false, partnerBackfillDone: false }, member: null, draft: null }

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

function saveDraft(draft) {
  const state = getState()
  state.draft = { ...draft, date: dateKey(), updatedAt: Date.now() }
  return saveState(state)
}

function clearDraft() {
  const state = getState()
  state.draft = null
  return saveState(state)
}

function completeWorkout(dayIndex, options = {}) {
  const state = getState()
  const key = dateKey()
  const mode = options.mode || 'standard'
  const workout = getWorkout(dayIndex, mode)
  const totalExercises = workout.exercises.length
  const completedExercises = Math.max(1, Math.min(totalExercises, options.completedExercises || totalExercises))
  const full = options.full !== false && completedExercises >= totalExercises
  const previous = state.records[key]
  const previousSeconds = previous ? (previous.durationSeconds || previous.minutes * 60 || 0) : 0
  const sessionSeconds = Math.max(60, Math.round(options.elapsedSeconds || 60))
  const durationSeconds = previousSeconds + sessionSeconds
  const type = (previous && previous.type === 'complete') || (full && mode === 'standard') ? 'complete' : 'light'
  state.records = {
    ...state.records,
    [key]: {
      date: key,
      title: workout.title,
      minutes: Math.max(1, Math.round(durationSeconds / 60)),
      durationSeconds,
      exercises: Math.max(previous ? previous.exercises : 0, completedExercises),
      totalExercises: Math.max(previous ? previous.totalExercises || previous.exercises : 0, totalExercises),
      sessions: (previous ? previous.sessions || 1 : 0) + 1,
      type,
      mode,
      completedAt: Date.now()
    }
  }
  state.draft = null
  saveState(state)
  return getSummary()
}

function getWeekCount(records) {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return Object.keys(records).filter(key => {
    const date = fromKey(key)
    return date >= monday && date <= now
  }).length
}

function getSummary() {
  const { records } = getState()
  const values = Object.values(records)
  return {
    streak: getStreak(records),
    weekCount: getWeekCount(records),
    total: values.length,
    minutes: values.reduce((sum, item) => sum + (item.minutes || 0), 0)
  }
}

module.exports = { init, getState, saveSettings, saveMember, saveDraft, clearDraft, completeWorkout, getSummary }
