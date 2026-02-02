// AI音乐节奏游戏 - 微信小游戏版

// Canvas
let canvas = null;
let ctx = null;

// 音频上下文
let audioContext = null;
let currentBGM = null;

// 游戏配置
const config = {
  canvasWidth: 375,
  canvasHeight: 667,
  tracks: 4,
  trackWidth: 80,
  hitZoneY: 550,
  hitZoneHeight: 80,
  noteSpeed: 5,
  perfectRange: 30,
  goodRange: 60,
  okRange: 90
};

// 游戏状态
let gameState = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  perfect: 0,
  good: 0,
  ok: 0,
  miss: 0,
  isPlaying: false,
  gameOver: false,
  difficulty: 'normal',
  bpm: 120,
  energy: 50
};

// 游戏对象
let notes = [];
let effects = [];
let particles = [];
let beatPattern = [];
let nextNoteTime = 0;
let gameStartTime = 0;
let beatIndex = 0;

// AI音乐生成器
class AIBeatGenerator {
  constructor(bpm, difficulty) {
    this.bpm = bpm;
    this.difficulty = difficulty;
    this.beatInterval = (60 / bpm) * 1000;
    this.patterns = this.generatePatterns();
    this.currentPattern = 0;
    this.lastIntensity = 0.5;
  }
  
  generatePatterns() {
    const patterns = [];
    const difficulties = {
      easy: { density: 0.4, complexity: 0.3 },
      normal: { density: 0.6, complexity: 0.5 },
      hard: { density: 0.8, complexity: 0.7 }
    };
    
    const diff = difficulties[this.difficulty] || difficulties.normal;
    
    // 生成8小节的模式
    for (let bar = 0; bar < 8; bar++) {
      const pattern = [];
      const intensity = 0.3 + Math.sin(bar * Math.PI / 4) * 0.4; // 动态强度
      
      // 每小节16个位置（16分音符）
      for (let beat = 0; beat < 16; beat++) {
        const isStrongBeat = beat % 4 === 0;
        const isWeakBeat = beat % 2 === 0;
        
        let probability = diff.density * intensity;
        if (isStrongBeat) probability *= 1.5;
        else if (isWeakBeat) probability *= 1.2;
        
        if (Math.random() < probability) {
          const track = Math.floor(Math.random() * config.tracks);
          const isLong = Math.random() < diff.complexity * 0.3;
          const isSpecial = Math.random() < diff.complexity * 0.2;
          
          pattern.push({
            track: track,
            beat: beat,
            type: isSpecial ? 'special' : (isLong ? 'long' : 'normal'),
            intensity: intensity
          });
        }
      }
      
      patterns.push(pattern);
    }
    
    return patterns;
  }
  
  getNextNotes() {
    const pattern = this.patterns[this.currentPattern % this.patterns.length];
    this.currentPattern++;
    return pattern;
  }
  
  adaptToDifficulty(performance) {
    // 根据玩家表现调整难度
    if (performance > 0.9 && this.bpm < 180) {
      this.bpm += 5;
      this.beatInterval = (60 / this.bpm) * 1000;
    } else if (performance < 0.6 && this.bpm > 80) {
      this.bpm -= 5;
      this.beatInterval = (60 / this.bpm) * 1000;
    }
  }
}

let beatGenerator = null;

// 初始化
wx.onShow(() => {
  console.log('AI音乐节奏游戏启动');
});

// 创建Canvas
canvas = wx.createCanvas();
ctx = canvas.getContext('2d');

// 设置Canvas尺寸
const systemInfo = wx.getSystemInfoSync();
const screenWidth = systemInfo.screenWidth;
const screenHeight = systemInfo.screenHeight;
const dpr = systemInfo.pixelRatio;

canvas.width = screenWidth * dpr;
canvas.height = screenHeight * dpr;
ctx.scale(dpr, dpr);

config.canvasWidth = screenWidth;
config.canvasHeight = screenHeight;
config.trackWidth = (screenWidth - 40) / config.tracks;
config.hitZoneY = screenHeight - 150;

// 创建音频上下文
audioContext = wx.createInnerAudioContext ? wx.createInnerAudioContext() : null;

// 创建音符
function createNote(track, type, beat) {
  return {
    track: track,
    y: -50,
    type: type,
    beat: beat,
    hit: false,
    missed: false,
    size: config.trackWidth * 0.8,
    speed: config.noteSpeed,
    color: getNoteColor(type),
    glowIntensity: 0
  };
}

// 获取音符颜色
function getNoteColor(type) {
  const colors = {
    normal: '#00D9FF',
    long: '#FF00FF',
    special: '#FFD700'
  };
  return colors[type] || colors.normal;
}

// 创建打击效果
function createHitEffect(x, y, quality) {
  return {
    x: x,
    y: y,
    quality: quality,
    alpha: 1,
    scale: 0.5,
    lifetime: 500,
    createdTime: Date.now()
  };
}

// 创建粒子
function createParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * (2 + Math.random() * 3),
      vy: Math.sin(angle) * (2 + Math.random() * 3) - 2,
      size: 3 + Math.random() * 3,
      color: color,
      alpha: 1,
      lifetime: 800,
      createdTime: Date.now()
    });
  }
}

// 获取音轨X坐标
function getTrackX(track) {
  return 20 + track * config.trackWidth + config.trackWidth / 2;
}

// 播放音效
function playSound(frequency, duration = 100, type = 'sine') {
  try {
    const webAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = webAudioContext.createOscillator();
    const gainNode = webAudioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(webAudioContext.destination);
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(0.3, webAudioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, webAudioContext.currentTime + duration / 1000);
    
    oscillator.start(webAudioContext.currentTime);
    oscillator.stop(webAudioContext.currentTime + duration / 1000);
  } catch (e) {
    console.log('音效播放失败', e);
  }
}

// 播放打击音效
function playHitSound(track, quality) {
  const baseFreq = 220;
  const frequencies = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];
  const freq = frequencies[track] || baseFreq;
  
  if (quality === 'perfect') {
    playSound(freq * 2, 120, 'sine');
  } else if (quality === 'good') {
    playSound(freq * 1.5, 100, 'sine');
  } else if (quality === 'ok') {
    playSound(freq, 80, 'triangle');
  }
}

// 生成背景音乐节拍
function generateBGMBeats() {
  const beats = [];
  const now = Date.now();
  
  for (let i = 0; i < 100; i++) {
    beats.push(now + i * beatGenerator.beatInterval);
  }
  
  return beats;
}

// 生成音符
function spawnNotes() {
  const now = Date.now() - gameStartTime;
  
  if (now > nextNoteTime) {
    const pattern = beatGenerator.getNextNotes();
    
    pattern.forEach(noteData => {
      const delay = (noteData.beat / 16) * beatGenerator.beatInterval * 4;
      
      setTimeout(() => {
        if (gameState.isPlaying && !gameState.gameOver) {
          notes.push(createNote(noteData.track, noteData.type, noteData.beat));
          
          // 播放预告音效
          const freq = 220 * (1 + noteData.track * 0.25);
          playSound(freq, 50, 'square');
        }
      }, delay);
    });
    
    nextNoteTime = now + beatGenerator.beatInterval * 4;
  }
}

// 绘制游戏
function draw() {
  // 渐变背景
  const gradient = ctx.createLinearGradient(0, 0, 0, config.canvasHeight);
  gradient.addColorStop(0, `hsl(${(Date.now() / 50) % 360}, 70%, 15%)`);
  gradient.addColorStop(1, `hsl(${((Date.now() / 50) + 60) % 360}, 70%, 5%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, config.canvasWidth, config.canvasHeight);
  
  // 绘制背景网格效果
  drawBackgroundGrid();
  
  // 绘制音轨
  drawTracks();
  
  // 绘制判定区域
  drawHitZone();
  
  // 绘制音符
  drawNotes();
  
  // 绘制粒子
  drawParticles();
  
  // 绘制打击效果
  drawEffects();
  
  // 绘制UI
  drawUI();
  
  // 绘制能量条
  drawEnergyBar();
  
  // 绘制游戏状态
  if (!gameState.isPlaying) {
    drawStartScreen();
  }
  
  if (gameState.gameOver) {
    drawGameOverScreen();
  }
}

// 绘制背景网格
function drawBackgroundGrid() {
  const time = Date.now() / 1000;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < 10; i++) {
    const y = ((time * 100 + i * 50) % config.canvasHeight);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(config.canvasWidth, y);
    ctx.stroke();
  }
}

// 绘制音轨
function drawTracks() {
  for (let i = 0; i < config.tracks; i++) {
    const x = 20 + i * config.trackWidth;
    
    // 音轨背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(x, 0, config.trackWidth, config.canvasHeight);
    
    // 音轨边界
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, 0, config.trackWidth, config.canvasHeight);
  }
}

// 绘制判定区域
function drawHitZone() {
  const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
  
  for (let i = 0; i < config.tracks; i++) {
    const x = 20 + i * config.trackWidth;
    
    // 判定区域外框
    ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 5, config.hitZoneY, config.trackWidth - 10, config.hitZoneHeight);
    
    // 完美区域
    ctx.fillStyle = 'rgba(0, 255, 100, 0.1)';
    const perfectY = config.hitZoneY + config.hitZoneHeight / 2 - config.perfectRange;
    ctx.fillRect(x + 5, perfectY, config.trackWidth - 10, config.perfectRange * 2);
  }
  
  // 判定线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, config.hitZoneY + config.hitZoneHeight / 2);
  ctx.lineTo(config.canvasWidth - 20, config.hitZoneY + config.hitZoneHeight / 2);
  ctx.stroke();
}

// 绘制音符
function drawNotes() {
  notes.forEach(note => {
    if (note.hit) return;
    
    const x = getTrackX(note.track);
    
    // 音符光晕
    const gradient = ctx.createRadialGradient(x, note.y, 0, x, note.y, note.size);
    gradient.addColorStop(0, note.color);
    gradient.addColorStop(0.7, note.color + '80');
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x - note.size, note.y - note.size, note.size * 2, note.size * 2);
    
    // 音符主体
    ctx.fillStyle = note.color;
    ctx.beginPath();
    
    if (note.type === 'special') {
      // 特殊音符 - 星形
      drawStar(ctx, x, note.y, note.size * 0.4, note.size * 0.2, 5);
    } else if (note.type === 'long') {
      // 长音符 - 矩形
      ctx.fillRect(x - note.size * 0.3, note.y - note.size * 0.5, note.size * 0.6, note.size);
    } else {
      // 普通音符 - 圆形
      ctx.arc(x, note.y, note.size * 0.4, 0, Math.PI * 2);
    }
    
    ctx.fill();
    
    // 音符边框
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// 绘制星形
function drawStar(ctx, cx, cy, outerRadius, innerRadius, points) {
  const step = Math.PI / points;
  ctx.beginPath();
  
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.closePath();
}

// 绘制粒子
function drawParticles() {
  const now = Date.now();
  
  particles.forEach(particle => {
    const age = now - particle.createdTime;
    const progress = age / particle.lifetime;
    
    particle.alpha = 1 - progress;
    
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fillStyle = `${particle.color}${Math.floor(particle.alpha * 255).toString(16).padStart(2, '0')}`;
    ctx.fill();
  });
}

// 绘制打击效果
function drawEffects() {
  const now = Date.now();
  
  effects.forEach(effect => {
    const age = now - effect.createdTime;
    const progress = age / effect.lifetime;
    
    effect.alpha = 1 - progress;
    effect.scale = 0.5 + progress * 1.5;
    
    ctx.save();
    ctx.globalAlpha = effect.alpha;
    ctx.translate(effect.x, effect.y);
    ctx.scale(effect.scale, effect.scale);
    
    const qualityText = {
      perfect: 'PERFECT',
      good: 'GOOD',
      ok: 'OK',
      miss: 'MISS'
    };
    
    const qualityColor = {
      perfect: '#FFD700',
      good: '#00FF00',
      ok: '#FFA500',
      miss: '#FF0000'
    };
    
    ctx.fillStyle = qualityColor[effect.quality];
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(qualityText[effect.quality], 0, 0);
    
    ctx.restore();
  });
}

// 绘制UI
function drawUI() {
  // 顶部信息栏
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, config.canvasWidth, 80);
  
  // 分数
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`分数: ${gameState.score}`, 20, 30);
  
  // Combo
  if (gameState.combo > 0) {
    ctx.fillStyle = gameState.combo > 10 ? '#FF00FF' : '#00D9FF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`COMBO ${gameState.combo}`, config.canvasWidth / 2, 30);
  }
  
  // BPM
  ctx.fillStyle = '#FFF';
  ctx.font = '16px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`BPM: ${gameState.bpm}`, config.canvasWidth - 20, 25);
  ctx.fillText(`难度: ${gameState.difficulty}`, config.canvasWidth - 20, 50);
  
  // 统计信息
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`P:${gameState.perfect}`, 20, 55);
  ctx.fillStyle = '#00FF00';
  ctx.fillText(`G:${gameState.good}`, 70, 55);
  ctx.fillStyle = '#FFA500';
  ctx.fillText(`O:${gameState.ok}`, 120, 55);
  ctx.fillStyle = '#FF0000';
  ctx.fillText(`M:${gameState.miss}`, 170, 55);
}

// 绘制能量条
function drawEnergyBar() {
  const barWidth = config.canvasWidth - 40;
  const barHeight = 10;
  const x = 20;
  const y = config.canvasHeight - 30;
  
  // 背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x, y, barWidth, barHeight);
  
  // 能量
  const energyGradient = ctx.createLinearGradient(x, y, x + barWidth, y);
  energyGradient.addColorStop(0, '#FF00FF');
  energyGradient.addColorStop(0.5, '#00D9FF');
  energyGradient.addColorStop(1, '#FFD700');
  
  ctx.fillStyle = energyGradient;
  ctx.fillRect(x, y, barWidth * (gameState.energy / 100), barHeight);
  
  // 边框
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barWidth, barHeight);
}

// 绘制开始界面
function drawStartScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, config.canvasWidth, config.canvasHeight);
  
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🎵 AI音乐节奏', config.canvasWidth / 2, config.canvasHeight / 2 - 120);
  
  ctx.fillStyle = '#FFF';
  ctx.font = '20px Arial';
  ctx.fillText('点击屏幕开始游戏', config.canvasWidth / 2, config.canvasHeight / 2 - 60);
  
  // 难度选择
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('选择难度:', config.canvasWidth / 2, config.canvasHeight / 2 - 10);
  
  const difficulties = ['easy', 'normal', 'hard'];
  const diffNames = { easy: '简单', normal: '普通', hard: '困难' };
  
  difficulties.forEach((diff, i) => {
    const y = config.canvasHeight / 2 + 30 + i * 40;
    const isSelected = gameState.difficulty === diff;
    
    ctx.fillStyle = isSelected ? '#FFD700' : 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(config.canvasWidth / 2 - 80, y - 15, 160, 30);
    
    ctx.fillStyle = '#000';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(diffNames[diff], config.canvasWidth / 2, y);
  });
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '14px Arial';
  ctx.fillText('音符落到判定区时点击对应轨道', config.canvasWidth / 2, config.canvasHeight - 80);
  ctx.fillText('Perfect: 金色区域  Good: 绿色区域', config.canvasWidth / 2, config.canvasHeight - 55);
}

// 绘制游戏结束界面
function drawGameOverScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, config.canvasWidth, config.canvasHeight);
  
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('游戏结束!', config.canvasWidth / 2, config.canvasHeight / 2 - 150);
  
  ctx.fillStyle = '#FFF';
  ctx.font = '24px Arial';
  ctx.fillText(`最终分数: ${gameState.score}`, config.canvasWidth / 2, config.canvasHeight / 2 - 90);
  ctx.fillText(`最大Combo: ${gameState.maxCombo}`, config.canvasWidth / 2, config.canvasHeight / 2 - 50);
  
  // 统计
  ctx.font = '18px Arial';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`Perfect: ${gameState.perfect}`, config.canvasWidth / 2, config.canvasHeight / 2);
  ctx.fillStyle = '#00FF00';
  ctx.fillText(`Good: ${gameState.good}`, config.canvasWidth / 2, config.canvasHeight / 2 + 30);
  ctx.fillStyle = '#FFA500';
  ctx.fillText(`OK: ${gameState.ok}`, config.canvasWidth / 2, config.canvasHeight / 2 + 60);
  ctx.fillStyle = '#FF0000';
  ctx.fillText(`Miss: ${gameState.miss}`, config.canvasWidth / 2, config.canvasHeight / 2 + 90);
  
  // 准确率
  const total = gameState.perfect + gameState.good + gameState.ok + gameState.miss;
  const accuracy = total > 0 ? ((gameState.perfect * 100 + gameState.good * 80 + gameState.ok * 50) / (total * 100) * 100).toFixed(1) : 0;
  
  ctx.fillStyle = '#FFF';
  ctx.font = '20px Arial';
  ctx.fillText(`准确率: ${accuracy}%`, config.canvasWidth / 2, config.canvasHeight / 2 + 130);
  
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('点击屏幕重新开始', config.canvasWidth / 2, config.canvasHeight / 2 + 170);
}

// 更新游戏状态
function update() {
  if (!gameState.isPlaying || gameState.gameOver) {
    return;
  }
  
  const now = Date.now();
  
  // 生成音符
  spawnNotes();
  
  // 更新音符
  updateNotes();
  
  // 更新粒子
  updateParticles();
  
  // 更新效果
  updateEffects();
  
  // 更新能量
  updateEnergy();
  
  // 检查游戏结束
  if (gameState.energy <= 0) {
    gameOver();
  }
}

// 更新音符
function updateNotes() {
  for (let i = notes.length - 1; i >= 0; i--) {
    const note = notes[i];
    
    if (note.hit) continue;
    
    note.y += note.speed;
    
    // 检查是否Miss
    if (note.y > config.hitZoneY + config.hitZoneHeight + 50 && !note.missed) {
      note.missed = true;
      gameState.miss++;
      gameState.combo = 0;
      gameState.energy = Math.max(0, gameState.energy - 5);
      
      effects.push(createHitEffect(getTrackX(note.track), config.hitZoneY + config.hitZoneHeight / 2, 'miss'));
      wx.vibrateShort({ type: 'heavy' });
    }
    
    // 移除超出屏幕的音符
    if (note.y > config.canvasHeight + 100 || note.hit) {
      notes.splice(i, 1);
    }
  }
}

// 更新粒子
function updateParticles() {
  const now = Date.now();
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.2; // 重力
    
    if (now - particle.createdTime > particle.lifetime) {
      particles.splice(i, 1);
    }
  }
}

// 更新效果
function updateEffects() {
  const now = Date.now();
  
  for (let i = effects.length - 1; i >= 0; i--) {
    if (now - effects[i].createdTime > effects[i].lifetime) {
      effects.splice(i, 1);
    }
  }
}

// 更新能量
function updateEnergy() {
  // 能量随时间缓慢恢复
  gameState.energy = Math.min(100, gameState.energy + 0.05);
}

// 处理点击
function handleTap(x, y) {
  if (!gameState.isPlaying) return;
  
  // 判断点击的音轨
  const track = Math.floor((x - 20) / config.trackWidth);
  if (track < 0 || track >= config.tracks) return;
  
  // 查找该音轨上最近的音符
  let closestNote = null;
  let minDistance = Infinity;
  
  notes.forEach(note => {
    if (note.track === track && !note.hit && !note.missed) {
      const distance = Math.abs(note.y - (config.hitZoneY + config.hitZoneHeight / 2));
      if (distance < minDistance && distance < config.okRange) {
        minDistance = distance;
        closestNote = note;
      }
    }
  });
  
  if (closestNote) {
    closestNote.hit = true;
    
    let quality = 'miss';
    let score = 0;
    let energyGain = 0;
    
    if (minDistance < config.perfectRange) {
      quality = 'perfect';
      score = 100 + closestNote.type === 'special' ? 50 : 0;
      energyGain = 5;
      gameState.perfect++;
    } else if (minDistance < config.goodRange) {
      quality = 'good';
      score = 50;
      energyGain = 3;
      gameState.good++;
    } else if (minDistance < config.okRange) {
      quality = 'ok';
      score = 20;
      energyGain = 1;
      gameState.ok++;
    }
    
    gameState.combo++;
    gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo);
    gameState.score += score * (1 + Math.floor(gameState.combo / 10) * 0.5);
    gameState.energy = Math.min(100, gameState.energy + energyGain);
    
    const trackX = getTrackX(track);
    effects.push(createHitEffect(trackX, closestNote.y, quality));
    createParticles(trackX, closestNote.y, 8, closestNote.color);
    
    playHitSound(track, quality);
    wx.vibrateShort({ type: quality === 'perfect' ? 'medium' : 'light' });
    
    // 根据表现调整难度
    if (gameState.score % 500 === 0) {
      const performance = gameState.perfect / (gameState.perfect + gameState.good + gameState.ok + gameState.miss);
      beatGenerator.adaptToDifficulty(performance);
      gameState.bpm = beatGenerator.bpm;
    }
  }
}

// 游戏结束
function gameOver() {
  gameState.gameOver = true;
  gameState.isPlaying = false;
  wx.vibrateShort({ type: 'heavy' });
}

// 开始游戏
function startGame() {
  gameState.score = 0;
  gameState.combo = 0;
  gameState.maxCombo = 0;
  gameState.perfect = 0;
  gameState.good = 0;
  gameState.ok = 0;
  gameState.miss = 0;
  gameState.isPlaying = true;
  gameState.gameOver = false;
  gameState.bpm = gameState.difficulty === 'easy' ? 100 : (gameState.difficulty === 'normal' ? 120 : 140);
  gameState.energy = 50;
  
  notes = [];
  effects = [];
  particles = [];
  beatIndex = 0;
  gameStartTime = Date.now();
  nextNoteTime = 1000; // 1秒后开始生成
  
  beatGenerator = new AIBeatGenerator(gameState.bpm, gameState.difficulty);
}

// 游戏循环
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// 触摸事件
wx.onTouchStart((e) => {
  const touch = e.touches[0];
  const x = touch.clientX;
  const y = touch.clientY;
  
  if (!gameState.isPlaying && !gameState.gameOver) {
    // 检查难度选择
    const difficulties = ['easy', 'normal', 'hard'];
    difficulties.forEach((diff, i) => {
      const buttonY = config.canvasHeight / 2 + 30 + i * 40;
      if (y >= buttonY - 15 && y <= buttonY + 15 && 
          x >= config.canvasWidth / 2 - 80 && x <= config.canvasWidth / 2 + 80) {
        gameState.difficulty = diff;
        wx.vibrateShort({ type: 'light' });
      }
    });
    
    // 检查是否点击开始
    if (y < config.canvasHeight / 2 - 40 || y > config.canvasHeight / 2 + 150) {
      startGame();
    }
    return;
  }
  
  if (gameState.gameOver) {
    startGame();
    return;
  }
  
  handleTap(x, y);
});

// 启动游戏循环
gameLoop();
