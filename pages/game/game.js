Page({
  data: {
    score: 0,
    bestScore: 0,
    ballCount: 1,
    isPlaying: false,
    isAiming: false,
    gameOver: false
  },

  onLoad() {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.pixelRatio = systemInfo.pixelRatio;
    
    // 从本地存储读取最高分
    const bestScore = wx.getStorageSync('bestScore') || 0;
    this.setData({ bestScore });
    
    // 初始化canvas
    this.initCanvas();
  },

  onReady() {
    // 页面准备完成后初始化游戏
    this.initGame();
  },

  onUnload() {
    // 页面卸载时停止游戏循环
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  },

  // 初始化canvas
  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 设置canvas实际大小
        const dpr = this.pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        
        this.canvas = canvas;
        this.ctx = ctx;
        this.canvasWidth = res[0].width;
        this.canvasHeight = res[0].height;
        
        // 初始化游戏
        this.initGame();
      });
  },

  // 初始化游戏
  initGame() {
    if (!this.ctx) return;

    // 游戏配置
    this.config = {
      ballRadius: 5,
      ballSpeed: 8,
      blockSize: 60,
      blockPadding: 5,
      blockRows: 6,
      maxBlockValue: 10,
      shooterY: this.canvasHeight - 80
    };

    // 计算每行可以放多少个方块
    this.blocksPerRow = Math.floor((this.canvasWidth - 20) / (this.config.blockSize + this.config.blockPadding));

    // 球的发射位置
    this.shooterX = this.canvasWidth / 2;
    
    // 球的数组
    this.balls = [];
    this.ballCount = 1;
    this.setData({ ballCount: 1 });
    
    // 方块数组
    this.blocks = [];
    
    // 奖励球数组
    this.bonusBalls = [];
    
    // 瞄准相关
    this.aimAngle = -Math.PI / 2;
    this.aimStartX = 0;
    this.aimStartY = 0;
    
    // 发射相关
    this.isShooting = false;
    this.shootDelay = 0;
    this.shootInterval = 3; // 每3帧发射一个球
    this.shootCount = 0;
    
    // 回合数
    this.round = 0;
    this.allBallsReturned = true;
    this.firstBallX = this.shooterX;
    
    // 初始化一些方块
    this.initBlocks();
    
    this.draw();
  },

  // 初始化方块
  initBlocks() {
    // 清空现有方块
    this.blocks = [];
    this.bonusBalls = [];
    
    // 生成第一行方块
    this.addNewBlockRow();
  },

  // 添加新的一行方块
  addNewBlockRow() {
    this.round++;
    
    // 将所有方块下移一行
    const blockHeight = this.config.blockSize + this.config.blockPadding;
    this.blocks.forEach(block => {
      block.y += blockHeight;
    });
    
    this.bonusBalls.forEach(bonus => {
      bonus.y += blockHeight;
    });
    
    // 检查是否有方块到达底部
    const bottomY = this.config.shooterY - 20;
    if (this.blocks.some(block => block.y + this.config.blockSize > bottomY)) {
      this.gameOver();
      return;
    }
    
    // 生成新的一行方块
    const startX = 10;
    const blockWidth = this.config.blockSize + this.config.blockPadding;
    const positions = [];
    
    for (let i = 0; i < this.blocksPerRow; i++) {
      positions.push(i);
    }
    
    // 随机选择3-6个位置放置方块或奖励球
    const count = Math.floor(Math.random() * 4) + 3;
    const selectedPositions = [];
    
    for (let i = 0; i < count; i++) {
      if (positions.length === 0) break;
      const index = Math.floor(Math.random() * positions.length);
      selectedPositions.push(positions.splice(index, 1)[0]);
    }
    
    selectedPositions.forEach(pos => {
      const x = startX + pos * blockWidth;
      const y = 20;
      
      // 10%概率生成奖励球，其余生成方块
      if (Math.random() < 0.15) {
        this.bonusBalls.push({
          x: x + this.config.blockSize / 2,
          y: y + this.config.blockSize / 2,
          radius: 8,
          collected: false
        });
      } else {
        const value = Math.min(this.round, this.config.maxBlockValue * this.round);
        this.blocks.push({
          x: x,
          y: y,
          value: value,
          maxValue: value,
          color: this.getBlockColor(value)
        });
      }
    });
  },

  // 根据方块值获取颜色
  getBlockColor(value) {
    const colors = [
      '#4ECDC4', '#45B7D1', '#5F9EA0', 
      '#FF6B6B', '#FFA07A', '#F08080',
      '#DDA0DD', '#DA70D6', '#BA55D3'
    ];
    
    const index = Math.min(Math.floor(value / 5), colors.length - 1);
    return colors[index];
  },

  // 绘制游戏
  draw() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    
    // 清空画布
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // 绘制方块
    this.drawBlocks();
    
    // 绘制奖励球
    this.drawBonusBalls();
    
    // 绘制发射的球
    this.drawBalls();
    
    // 绘制发射器
    this.drawShooter();
    
    // 绘制瞄准线
    if (this.data.isAiming && !this.isShooting) {
      this.drawAimLine();
    }

    // 绘制游戏结束提示
    if (this.data.gameOver) {
      this.drawGameOverScreen();
    }
  },

  // 绘制方块
  drawBlocks() {
    const ctx = this.ctx;
    const size = this.config.blockSize;
    
    this.blocks.forEach(block => {
      // 绘制方块背景
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, block.y, size, size);
      
      // 绘制边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x, block.y, size, size);
      
      // 绘制数字
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(block.value, block.x + size / 2, block.y + size / 2);
    });
  },

  // 绘制奖励球
  drawBonusBalls() {
    const ctx = this.ctx;
    
    this.bonusBalls.forEach(bonus => {
      if (!bonus.collected) {
        // 绘制外圈
        ctx.beginPath();
        ctx.arc(bonus.x, bonus.y, bonus.radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制内圈
        ctx.beginPath();
        ctx.arc(bonus.x, bonus.y, bonus.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        
        // 绘制+号
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bonus.x - 3, bonus.y);
        ctx.lineTo(bonus.x + 3, bonus.y);
        ctx.moveTo(bonus.x, bonus.y - 3);
        ctx.lineTo(bonus.x, bonus.y + 3);
        ctx.stroke();
      }
    });
  },

  // 绘制球
  drawBalls() {
    const ctx = this.ctx;
    
    this.balls.forEach(ball => {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, this.config.ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fff';
      ctx.fill();
      ctx.closePath();
      ctx.shadowBlur = 0;
    });
  },

  // 绘制发射器
  drawShooter() {
    const ctx = this.ctx;
    
    // 绘制发射位置指示器
    ctx.beginPath();
    ctx.arc(this.shooterX, this.config.shooterY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 绘制球数量
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.ballCount, this.shooterX, this.config.shooterY + 30);
  },

  // 绘制瞄准线
  drawAimLine() {
    const ctx = this.ctx;
    const length = 100;
    const endX = this.shooterX + Math.cos(this.aimAngle) * length;
    const endY = this.config.shooterY + Math.sin(this.aimAngle) * length;
    
    ctx.beginPath();
    ctx.moveTo(this.shooterX, this.config.shooterY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制箭头
    const arrowSize = 8;
    ctx.save();
    ctx.translate(endX, endY);
    ctx.rotate(this.aimAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowSize, -arrowSize / 2);
    ctx.lineTo(-arrowSize, arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
    ctx.restore();
  },

  // 绘制游戏结束界面
  drawGameOverScreen() {
    const ctx = this.ctx;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束!', this.canvasWidth / 2, this.canvasHeight / 2 - 60);
    
    ctx.font = '24px Arial';
    ctx.fillText(`得分: ${this.data.score}`, this.canvasWidth / 2, this.canvasHeight / 2);
    ctx.fillText(`最高分: ${this.data.bestScore}`, this.canvasWidth / 2, this.canvasHeight / 2 + 40);
    ctx.fillText(`回合数: ${this.round}`, this.canvasWidth / 2, this.canvasHeight / 2 + 80);
  },

  // 更新游戏状态
  update() {
    if (!this.data.isPlaying || this.data.gameOver) {
      return;
    }

    // 处理发射
    if (this.isShooting && this.allBallsReturned) {
      this.shootDelay++;
      
      if (this.shootDelay >= this.shootInterval && this.shootCount < this.ballCount) {
        this.shootBall();
        this.shootDelay = 0;
        this.shootCount++;
      }
      
      if (this.shootCount >= this.ballCount) {
        this.isShooting = false;
        this.allBallsReturned = false;
      }
    }

    // 更新所有球的位置
    this.updateBalls();
    
    // 检查是否所有球都返回了
    if (!this.allBallsReturned && this.balls.length === 0) {
      this.allBallsReturned = true;
      this.setData({ isAiming: true });
      
      // 更新发射器位置到第一个球落地的位置
      this.shooterX = this.firstBallX;
      
      // 添加新的一行方块
      this.addNewBlockRow();
    }
  },

  // 发射一个球
  shootBall() {
    this.balls.push({
      x: this.shooterX,
      y: this.config.shooterY,
      vx: Math.cos(this.aimAngle) * this.config.ballSpeed,
      vy: Math.sin(this.aimAngle) * this.config.ballSpeed,
      isFirst: this.balls.length === 0
    });
  },

  // 更新球的位置
  updateBalls() {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      
      ball.x += ball.vx;
      ball.y += ball.vy;
      
      // 墙壁碰撞
      if (ball.x - this.config.ballRadius < 0 || ball.x + this.config.ballRadius > this.canvasWidth) {
        ball.vx *= -1;
        ball.x = Math.max(this.config.ballRadius, Math.min(this.canvasWidth - this.config.ballRadius, ball.x));
      }
      
      if (ball.y - this.config.ballRadius < 0) {
        ball.vy *= -1;
        ball.y = this.config.ballRadius;
      }
      
      // 检查与方块的碰撞
      this.checkBallBlockCollision(ball);
      
      // 检查与奖励球的碰撞
      this.checkBonusBallCollision(ball);
      
      // 球到达底部
      if (ball.y > this.config.shooterY) {
        if (ball.isFirst) {
          this.firstBallX = ball.x;
        }
        this.balls.splice(i, 1);
      }
    }
  },

  // 检查球与方块的碰撞
  checkBallBlockCollision(ball) {
    const size = this.config.blockSize;
    const radius = this.config.ballRadius;
    
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const block = this.blocks[i];
      
      // 简单的AABB碰撞检测
      if (ball.x + radius > block.x && 
          ball.x - radius < block.x + size &&
          ball.y + radius > block.y && 
          ball.y - radius < block.y + size) {
        
        // 计算碰撞方向
        const ballCenterX = ball.x;
        const ballCenterY = ball.y;
        const blockCenterX = block.x + size / 2;
        const blockCenterY = block.y + size / 2;
        
        const dx = ballCenterX - blockCenterX;
        const dy = ballCenterY - blockCenterY;
        
        // 判断从哪个方向碰撞
        if (Math.abs(dx) > Math.abs(dy)) {
          ball.vx *= -1;
        } else {
          ball.vy *= -1;
        }
        
        // 减少方块值
        block.value--;
        
        if (block.value <= 0) {
          this.blocks.splice(i, 1);
          const newScore = this.data.score + 1;
          this.setData({ score: newScore });
          
          // 更新最高分
          if (newScore > this.data.bestScore) {
            this.setData({ bestScore: newScore });
            wx.setStorageSync('bestScore', newScore);
          }
        }
        
        wx.vibrateShort({ type: 'light' });
        break;
      }
    }
  },

  // 检查与奖励球的碰撞
  checkBonusBallCollision(ball) {
    for (let i = this.bonusBalls.length - 1; i >= 0; i--) {
      const bonus = this.bonusBalls[i];
      
      if (!bonus.collected) {
        const dx = ball.x - bonus.x;
        const dy = ball.y - bonus.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.config.ballRadius + bonus.radius) {
          bonus.collected = true;
          this.ballCount++;
          this.setData({ ballCount: this.ballCount });
          this.bonusBalls.splice(i, 1);
          wx.vibrateShort({ type: 'medium' });
        }
      }
    }
  },

  // 游戏结束
  gameOver() {
    this.setData({
      gameOver: true,
      isPlaying: false,
      isAiming: false
    });
    
    wx.vibrateShort({ type: 'heavy' });
  },

  // 游戏循环
  gameLoop() {
    if (!this.data.isPlaying && !this.data.gameOver) {
      return;
    }

    this.update();
    this.draw();

    if (this.data.isPlaying || this.data.gameOver) {
      this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
    }
  },

  // 开始游戏
  startGame() {
    // 重置游戏状态
    this.setData({
      score: 0,
      ballCount: 1,
      isPlaying: true,
      isAiming: true,
      gameOver: false
    });

    this.ballCount = 1;
    this.round = 0;
    this.balls = [];
    this.shooterX = this.canvasWidth / 2;
    this.firstBallX = this.shooterX;
    this.allBallsReturned = true;
    this.isShooting = false;
    this.shootCount = 0;
    
    this.initBlocks();
    this.gameLoop();
  },

  // 触摸开始
  onTouchStart(e) {
    if (!this.data.isPlaying || !this.data.isAiming || this.data.gameOver) return;
    
    this.aimStartX = e.touches[0].x;
    this.aimStartY = e.touches[0].y;
  },

  // 触摸移动
  onTouchMove(e) {
    if (!this.data.isPlaying || !this.data.isAiming || this.data.gameOver) return;
    
    const touchX = e.touches[0].x;
    const touchY = e.touches[0].y;
    
    // 计算角度
    const dx = touchX - this.shooterX;
    const dy = touchY - this.config.shooterY;
    
    // 限制角度在-170度到-10度之间（向上发射）
    let angle = Math.atan2(dy, dx);
    
    // 限制角度范围
    const minAngle = -Math.PI + 0.17; // -170度
    const maxAngle = -0.17; // -10度
    
    if (angle > 0) {
      angle = minAngle;
    } else if (angle > maxAngle) {
      angle = maxAngle;
    } else if (angle < minAngle) {
      angle = minAngle;
    }
    
    this.aimAngle = angle;
  },

  // 触摸结束
  onTouchEnd() {
    if (!this.data.isPlaying || !this.data.isAiming || this.data.gameOver) return;
    
    // 开始发射
    this.setData({ isAiming: false });
    this.isShooting = true;
    this.shootCount = 0;
    this.shootDelay = 0;
  }
});
