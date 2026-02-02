// 2048游戏 - 鸿蒙版
import promptAction from '@ohos.promptAction';
import vibrator from '@ohos.vibrator';

@Entry
@Component
struct Index {
  @State grid: number[][] = [];
  @State score: number = 0;
  @State bestScore: number = 0;
  @State gameOver: boolean = false;
  @State won: boolean = false;
  private gridSize: number = 4;
  private cellSize: number = 80;
  private cellGap: number = 10;
  
  aboutToAppear() {
    // 从本地存储加载最高分
    const stored = AppStorage.Get('bestScore');
    if (stored) {
      this.bestScore = stored as number;
    }
    this.initGame();
  }
  
  // 初始化游戏
  initGame() {
    this.grid = Array(this.gridSize).fill(0).map(() => Array(this.gridSize).fill(0));
    this.score = 0;
    this.gameOver = false;
    this.won = false;
    this.addRandomTile();
    this.addRandomTile();
  }
  
  // 添加随机方块
  addRandomTile() {
    const emptyCells: {row: number, col: number}[] = [];
    
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        if (this.grid[i][j] === 0) {
          emptyCells.push({row: i, col: j});
        }
      }
    }
    
    if (emptyCells.length > 0) {
      const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const value = Math.random() < 0.9 ? 2 : 4;
      this.grid[randomCell.row][randomCell.col] = value;
    }
  }
  
  // 获取方块颜色
  getTileColor(value: number): string {
    const colors: Record<number, string> = {
      0: '#cdc1b4',
      2: '#eee4da',
      4: '#ede0c8',
      8: '#f2b179',
      16: '#f59563',
      32: '#f67c5f',
      64: '#f65e3b',
      128: '#edcf72',
      256: '#edcc61',
      512: '#edc850',
      1024: '#edc53f',
      2048: '#edc22e'
    };
    return colors[value] || '#3c3a32';
  }
  
  // 获取文字颜色
  getTextColor(value: number): string {
    return value <= 4 ? '#776e65' : '#f9f6f2';
  }
  
  // 移动逻辑
  move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const oldGrid = JSON.stringify(this.grid);
    let moved = false;
    
    // 转换网格方向
    const rotated = this.rotateGrid(direction);
    
    // 向左移动并合并
    for (let i = 0; i < this.gridSize; i++) {
      const row = rotated[i].filter(cell => cell !== 0);
      const merged: number[] = [];
      
      for (let j = 0; j < row.length; j++) {
        if (j < row.length - 1 && row[j] === row[j + 1]) {
          merged.push(row[j] * 2);
          this.score += row[j] * 2;
          
          // 检查是否赢得游戏
          if (row[j] * 2 === 2048 && !this.won) {
            this.won = true;
          }
          
          j++; // 跳过下一个已合并的方块
        } else {
          merged.push(row[j]);
        }
      }
      
      // 填充0
      while (merged.length < this.gridSize) {
        merged.push(0);
      }
      
      rotated[i] = merged;
    }
    
    // 转换回原方向
    this.grid = this.unrotateGrid(rotated, direction);
    
    moved = oldGrid !== JSON.stringify(this.grid);
    
    if (moved) {
      this.addRandomTile();
      this.updateBestScore();
      this.checkGameOver();
      
      // 震动反馈
      vibrator.startVibration({
        type: 'time',
        duration: 50
      }, {
        id: 0,
        usage: 'touch'
      });
    }
    
    return moved;
  }
  
  // 旋转网格（用于统一处理四个方向）
  rotateGrid(direction: string): number[][] {
    let result = this.grid.map(row => [...row]);
    
    switch (direction) {
      case 'up':
        result = this.transpose(result);
        break;
      case 'down':
        result = this.transpose(result).map(row => row.reverse());
        break;
      case 'right':
        result = result.map(row => row.reverse());
        break;
      case 'left':
      default:
        break;
    }
    
    return result;
  }
  
  // 反旋转网格
  unrotateGrid(grid: number[][], direction: string): number[][] {
    let result = grid.map(row => [...row]);
    
    switch (direction) {
      case 'up':
        result = this.transpose(result);
        break;
      case 'down':
        result = result.map(row => row.reverse());
        result = this.transpose(result);
        break;
      case 'right':
        result = result.map(row => row.reverse());
        break;
      case 'left':
      default:
        break;
    }
    
    return result;
  }
  
  // 转置矩阵
  transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
  }
  
  // 检查游戏是否结束
  checkGameOver() {
    // 检查是否有空格
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        if (this.grid[i][j] === 0) return;
      }
    }
    
    // 检查是否可以合并
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        const current = this.grid[i][j];
        
        // 检查右侧
        if (j < this.gridSize - 1 && current === this.grid[i][j + 1]) return;
        
        // 检查下方
        if (i < this.gridSize - 1 && current === this.grid[i + 1][j]) return;
      }
    }
    
    this.gameOver = true;
  }
  
  // 更新最高分
  updateBestScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      AppStorage.SetOrCreate('bestScore', this.bestScore);
    }
  }
  
  // 重新开始
  restart() {
    this.initGame();
    promptAction.showToast({
      message: '游戏重新开始',
      duration: 1000
    });
  }
  
  build() {
    Column() {
      // 标题栏
      Row() {
        Text('2048')
          .fontSize(48)
          .fontWeight(FontWeight.Bold)
          .fontColor('#776e65')
        
        Blank()
        
        Column() {
          Text('最高分')
            .fontSize(14)
            .fontColor('#eee4da')
          Text(this.bestScore.toString())
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor('#ffffff')
        }
        .width(100)
        .height(60)
        .backgroundColor('#bbada0')
        .borderRadius(8)
        .justifyContent(FlexAlign.Center)
        .margin({ right: 10 })
        
        Column() {
          Text('分数')
            .fontSize(14)
            .fontColor('#eee4da')
          Text(this.score.toString())
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor('#ffffff')
        }
        .width(100)
        .height(60)
        .backgroundColor('#bbada0')
        .borderRadius(8)
        .justifyContent(FlexAlign.Center)
      }
      .width('90%')
      .margin({ top: 20, bottom: 20 })
      
      // 说明
      Row() {
        Text('使用滑动手势合并相同数字!')
          .fontSize(14)
          .fontColor('#776e65')
        
        Blank()
        
        Button('新游戏')
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .backgroundColor('#8f7a66')
          .fontColor('#f9f6f2')
          .borderRadius(6)
          .padding({ left: 15, right: 15, top: 8, bottom: 8 })
          .onClick(() => {
            this.restart();
          })
      }
      .width('90%')
      .margin({ bottom: 20 })
      
      // 游戏网格
      Stack() {
        // 背景网格
        Column() {
          ForEach(Array.from({length: this.gridSize}), (_, i: number) => {
            Row() {
              ForEach(Array.from({length: this.gridSize}), (_, j: number) => {
                Column()
                  .width(this.cellSize)
                  .height(this.cellSize)
                  .backgroundColor('#cdc1b4')
                  .borderRadius(6)
                  .margin(this.cellGap / 2)
              })
            }
          })
        }
        .width(this.gridSize * (this.cellSize + this.cellGap))
        .height(this.gridSize * (this.cellSize + this.cellGap))
        .backgroundColor('#bbada0')
        .borderRadius(8)
        .padding(this.cellGap / 2)
        
        // 方块
        Column() {
          ForEach(Array.from({length: this.gridSize}), (_, i: number) => {
            Row() {
              ForEach(Array.from({length: this.gridSize}), (_, j: number) => {
                if (this.grid[i][j] !== 0) {
                  Column() {
                    Text(this.grid[i][j].toString())
                      .fontSize(this.grid[i][j] < 100 ? 32 : (this.grid[i][j] < 1000 ? 28 : 24))
                      .fontWeight(FontWeight.Bold)
                      .fontColor(this.getTextColor(this.grid[i][j]))
                  }
                  .width(this.cellSize)
                  .height(this.cellSize)
                  .backgroundColor(this.getTileColor(this.grid[i][j]))
                  .borderRadius(6)
                  .margin(this.cellGap / 2)
                  .justifyContent(FlexAlign.Center)
                  .transition({
                    type: TransitionType.Insert,
                    opacity: 0,
                    scale: { x: 0.8, y: 0.8 }
                  })
                  .animation({
                    duration: 200,
                    curve: Curve.EaseInOut
                  })
                } else {
                  Column()
                    .width(this.cellSize)
                    .height(this.cellSize)
                    .margin(this.cellGap / 2)
                }
              })
            }
          })
        }
        .width(this.gridSize * (this.cellSize + this.cellGap))
        .height(this.gridSize * (this.cellSize + this.cellGap))
        .padding(this.cellGap / 2)
        
        // 游戏结束遮罩
        if (this.gameOver || this.won) {
          Column() {
            Text(this.won ? '你赢了! 🎉' : '游戏结束')
              .fontSize(36)
              .fontWeight(FontWeight.Bold)
              .fontColor('#ffffff')
              .margin({ bottom: 20 })
            
            Text(`最终分数: ${this.score}`)
              .fontSize(20)
              .fontColor('#ffffff')
              .margin({ bottom: 30 })
            
            Button(this.won ? '继续挑战' : '重新开始')
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .backgroundColor('#8f7a66')
              .fontColor('#f9f6f2')
              .borderRadius(8)
              .padding({ left: 30, right: 30, top: 12, bottom: 12 })
              .onClick(() => {
                if (this.won) {
                  this.won = false;
                } else {
                  this.restart();
                }
              })
          }
          .width('100%')
          .height('100%')
          .backgroundColor('rgba(238, 228, 218, 0.85)')
          .borderRadius(8)
          .justifyContent(FlexAlign.Center)
        }
      }
      .width(this.gridSize * (this.cellSize + this.cellGap))
      .height(this.gridSize * (this.cellSize + this.cellGap))
      .gesture(
        // 滑动手势
        SwipeGesture({ direction: SwipeDirection.All })
          .onAction((event: GestureEvent) => {
            if (this.gameOver) return;
            
            const angle = event.angle;
            
            // 根据角度判断方向
            if (angle >= 45 && angle < 135) {
              // 向下
              this.move('down');
            } else if (angle >= 135 && angle < 225) {
              // 向左
              this.move('left');
            } else if (angle >= 225 && angle < 315) {
              // 向上
              this.move('up');
            } else {
              // 向右
              this.move('right');
            }
          })
      )
      
      // 提示信息
      Text('滑动方向键控制，合并相同数字达到2048!')
        .fontSize(14)
        .fontColor('#776e65')
        .margin({ top: 30 })
        .textAlign(TextAlign.Center)
        .width('80%')
      
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#faf8ef')
    .justifyContent(FlexAlign.Start)
  }
}
