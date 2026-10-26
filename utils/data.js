const library = {
  squat: { name: '椅子深蹲', part: '腿部力量', reps: '3 组 × 10 次', seconds: 40, level: '基础', art: '蹲', color: '#E4A853', cues: ['坐在稳固椅面前，双脚与肩同宽', '膝盖朝向脚尖，缓慢站起再坐下', '起身时呼气，全程保持躯干稳定'], warning: '膝盖不适时缩小下蹲幅度，不要追求速度。' },
  push: { name: '墙壁俯卧撑', part: '胸肩力量', reps: '3 组 × 12 次', seconds: 40, level: '基础', art: '推', color: '#7C9B87', cues: ['双手撑墙，略宽于肩', '身体保持一条直线，缓慢靠近墙面', '推起时呼气，手肘不要完全锁死'], warning: '避免塌腰；手腕不适时可握拳支撑。' },
  row: { name: '弹力带划船', part: '背部力量', reps: '3 组 × 12 次', seconds: 40, level: '进阶', art: '拉', color: '#CB775B', cues: ['弹力带稳固固定在胸口高度', '肩膀远离耳朵，手肘贴近身体后拉', '停顿一秒，再缓慢回到起点'], warning: '确保固定点牢靠，不要借助腰部猛拉。' },
  bridge: { name: '臀桥', part: '臀腿力量', reps: '3 组 × 12 次', seconds: 40, level: '基础', art: '桥', color: '#9E9A70', cues: ['仰卧屈膝，双脚踩稳地面', '收紧腹部，用臀部发力抬起骨盆', '肩、髋、膝成一条斜线后缓慢落下'], warning: '不要过度挺腰，颈部保持放松。' },
  hinge: { name: '髋部折叠', part: '后侧链', reps: '3 组 × 10 次', seconds: 40, level: '基础', art: '髋', color: '#7799A0', cues: ['双脚与髋同宽，膝盖微微弯曲', '臀部向后移动，躯干自然前倾', '感受大腿后侧拉伸，再收紧臀部站起'], warning: '保持背部自然平直，幅度以舒适为准。' },
  balance: { name: '扶椅单腿站', part: '稳定平衡', reps: '左右各 30 秒', seconds: 40, level: '舒缓', art: '稳', color: '#8D82A0', cues: ['站在稳固椅子旁，单手轻扶椅背', '缓慢抬起一侧脚掌，腹部收紧', '目视前方，自然呼吸，左右交换'], warning: '务必扶稳支撑物，出现眩晕立即停止。' }
}

const weekly = [
  { short: '日', focus: '舒展', title: '舒展与平衡', subtitle: '轻松活动，找回身体控制', minutes: 10, exercises: ['balance', 'bridge', 'hinge'] },
  { short: '一', focus: '下肢', title: '下肢与核心', subtitle: '站稳每一步，从腿部开始', minutes: 16, exercises: ['squat', 'bridge', 'balance'] },
  { short: '二', focus: '上肢', title: '上肢推与拉', subtitle: '练出好体态，日常更有力', minutes: 18, exercises: ['push', 'row', 'hinge'] },
  { short: '三', focus: '全身', title: '全身基础力量', subtitle: '低冲击训练，唤醒全身肌肉', minutes: 18, exercises: ['squat', 'push', 'row', 'bridge'] },
  { short: '四', focus: '背臀', title: '背臀与稳定', subtitle: '改善久坐无力的身体状态', minutes: 16, exercises: ['row', 'bridge', 'balance'] },
  { short: '五', focus: '巩固', title: '全身力量巩固', subtitle: '稳稳发力，完成本周积累', minutes: 20, exercises: ['squat', 'push', 'hinge', 'row'] },
  { short: '六', focus: '灵活', title: '灵活与轻力量', subtitle: '适度锻炼，也给身体留白', minutes: 12, exercises: ['hinge', 'balance', 'bridge'] }
]

function getWorkout(dayIndex = new Date().getDay()) {
  const day = weekly[dayIndex]
  return { ...day, dayIndex, exercises: day.exercises.map((key, index) => ({ ...library[key], id: key, order: index + 1 })) }
}

module.exports = { weekly, getWorkout }
