/* ============================================================
   忆算 - 记忆算术挑战 | 游戏逻辑
   纯静态前端代码，无后端依赖
   兼容 Chrome（安卓）、华为浏览器（鸿蒙）、Safari（iPhone）、Edge（Windows）
   ============================================================ */

// ================================================================
// 一、全局状态管理
// ================================================================

/** 游戏阶段枚举 */
const PHASE = {
  IDLE: 'idle',           // 空闲（未开始）
  MEMORIZE: 'memorize',   // 记忆阶段：展示题目，倒计时
  ANSWER: 'answer',       // 答题阶段：回溯作答
  END: 'end'              // 游戏结束
};

/** 游戏核心状态 */
const gameState = {
  mode: null,                // 当前模式：'simple' | 'medium' | 'hard' | 'custom'
  phase: PHASE.IDLE,         // 当前阶段
  memorizedCount: 0,         // 预记忆题目数量 N
  range: 'ten',              // 题目范围：'ten'（十以内）| 'hundred'（百以内）
  queue: [],                 // 题目队列 [{a, b, operator, answer, display}]
  currentNewQuestion: null,  // 当前展示的新题（用户需要记住）
  expectedQuestion: null,    // 当前需要回答的旧题（从队列头部取出）
  score: 0,                  // 当前得分
  timerInterval: null,       // 倒计时定时器 ID
  countdown: 5,              // 当前倒计时秒数
  memorizeIndex: 0,          // 记忆阶段当前展示到第几题（0-based）
  currentInput: ''           // 用户当前输入的数字字符串
};

/** 自定义模式设置（独立保存，不随游戏重置） */
const customSettings = {
  count: 5,        // 预记题数，默认5
  range: 'ten'     // 题目范围，默认十以内
};


// ================================================================
// 二、出题函数
// ================================================================

/**
 * 生成一道随机加减法题目
 * @param {string} range - 题目范围：'ten'（十以内）| 'hundred'（百以内）
 * @returns {Object} { a, b, operator, answer, display }
 *   - 十以内：运算数 0~10，减法保证被减数≥减数（结果非负）
 *   - 百以内：运算数 0~99，加法结果可超99，减法保证结果非负
 */
function generateQuestion(range) {
  const max = range === 'ten' ? 10 : 99;
  // 随机决定加法还是减法（各50%概率）
  const isAddition = Math.random() < 0.5;
  let a, b, answer;

  if (isAddition) {
    // 加法：两数均在 0~max 范围内
    a = Math.floor(Math.random() * (max + 1));
    b = Math.floor(Math.random() * (max + 1));
    answer = a + b;
  } else {
    // 减法：保证被减数 ≥ 减数，结果非负
    a = Math.floor(Math.random() * (max + 1));
    b = Math.floor(Math.random() * (a + 1));  // b 在 0~a 之间
    answer = a - b;
  }

  const operator = isAddition ? '+' : '-';
  return {
    a: a,
    b: b,
    operator: operator,
    answer: answer,
    display: a + ' ' + operator + ' ' + b + ' = ?'
  };
}


// ================================================================
// 三、模式判断与游戏初始化
// ================================================================

/**
 * 根据模式名获取配置
 * @param {string} mode - 模式名
 * @returns {Object} { memorizedCount, range }
 */
function getModeConfig(mode) {
  switch (mode) {
    case 'simple':
      return { memorizedCount: 3, range: 'ten' };
    case 'medium':
      return { memorizedCount: 6, range: 'ten' };
    case 'hard':
      return { memorizedCount: 9, range: 'ten' };
    case 'custom':
      return { memorizedCount: customSettings.count, range: customSettings.range };
    default:
      return { memorizedCount: 3, range: 'ten' };
  }
}

/**
 * 获取模式中文名
 * @param {string} mode - 模式名
 * @returns {string} 中文名
 */
function getModeLabel(mode) {
  const labels = {
    simple: '简单模式',
    medium: '中等模式',
    hard: '困难模式',
    custom: '自定义模式'
  };
  return labels[mode] || '未知模式';
}

/**
 * 选择预设模式并直接开始游戏
 * @param {string} mode - 'simple' | 'medium' | 'hard'
 */
function selectMode(mode) {
  startGame(mode);
}

/**
 * 开始自定义模式游戏（从设置页调用）
 */
function startCustomGame() {
  startGame('custom');
}

/**
 * 开始一局新游戏
 * @param {string} mode - 模式名称
 */
function startGame(mode) {
  // 清理上一局残留的定时器
  clearGameTimers();

  // 获取模式配置
  const config = getModeConfig(mode);

  // 初始化游戏状态
  gameState.mode = mode;
  gameState.phase = PHASE.IDLE;
  gameState.memorizedCount = config.memorizedCount;
  gameState.range = config.range;
  gameState.queue = [];
  gameState.currentNewQuestion = null;
  gameState.expectedQuestion = null;
  gameState.score = 0;
  gameState.countdown = 5;
  gameState.memorizeIndex = 0;
  gameState.currentInput = '';

  // 生成预记忆题目队列（N道题）
  for (let i = 0; i < gameState.memorizedCount; i++) {
    gameState.queue.push(generateQuestion(gameState.range));
  }

  // 切换到游戏页面并更新UI
  showPage('game');
  document.getElementById('game-mode-label').textContent = getModeLabel(mode);
  updateScoreDisplay();

  // 进入记忆阶段
  startMemorizePhase();
}


// ================================================================
// 四、记忆阶段
// ================================================================

/**
 * 开始记忆阶段：依次展示题目，每道题自动倒计时
 */
function startMemorizePhase() {
  gameState.phase = PHASE.MEMORIZE;
  gameState.memorizeIndex = 0;

  // 显示记忆阶段UI，隐藏答题阶段UI
  document.getElementById('memorize-area').classList.remove('hidden');
  document.getElementById('answer-area').classList.add('hidden');

  // 展示第一道题
  showMemorizeQuestion();
}

/**
 * 展示当前记忆题目并启动倒计时
 */
function showMemorizeQuestion() {
  // 判断记忆阶段是否结束
  if (gameState.memorizeIndex >= gameState.memorizedCount) {
    // 全部题目展示完毕，进入答题阶段
    startAnswerPhase();
    return;
  }

  const question = gameState.queue[gameState.memorizeIndex];
  const currentNumber = gameState.memorizeIndex + 1;
  const totalNumber = gameState.memorizedCount;

  // 更新UI：进度文字、题目
  document.getElementById('memorize-progress').textContent =
    '第 ' + currentNumber + ' / ' + totalNumber + ' 题';
  document.getElementById('memorize-question').textContent = question.display;

  // 启动5秒倒计时
  startCountdown(5, function () {
    // 倒计时结束，进入下一道题
    gameState.memorizeIndex++;
    showMemorizeQuestion();
  });
}

/**
 * 启动倒计时
 * @param {number} seconds - 倒计时秒数
 * @param {Function} onComplete - 倒计时结束回调
 */
function startCountdown(seconds, onComplete) {
  gameState.countdown = seconds;
  updateCountdownDisplay(seconds);

  // 清除之前的定时器
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }

  gameState.timerInterval = setInterval(function () {
    gameState.countdown--;
    updateCountdownDisplay(gameState.countdown);

    // 最后1秒：视觉警告（变红+脉冲动画）
    if (gameState.countdown <= 1) {
      var circle = document.getElementById('countdown-circle');
      circle.classList.add('danger');
    }

    // 倒计时归零
    if (gameState.countdown <= 0) {
      clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;
      // 重置圆圈样式
      var circleEl = document.getElementById('countdown-circle');
      circleEl.classList.remove('danger', 'warning');
      if (onComplete) {
        onComplete();
      }
    }
  }, 1000);
}

/**
 * 更新倒计时显示
 * @param {number} seconds - 当前秒数
 */
function updateCountdownDisplay(seconds) {
  document.getElementById('countdown-number').textContent = seconds;
}


// ================================================================
// 五、答题阶段
// ================================================================

/**
 * 开始答题阶段：
 * 从队列头部取出第一道需要回答的旧题
 * 生成第一道新题供用户记忆
 */
function startAnswerPhase() {
  gameState.phase = PHASE.ANSWER;
  gameState.currentInput = '';

  // 切换UI：隐藏记忆区，显示答题区
  document.getElementById('memorize-area').classList.add('hidden');
  document.getElementById('answer-area').classList.remove('hidden');

  // 生成第一道"新题"（用户需要记住它，稍后回答）
  gameState.currentNewQuestion = generateQuestion(gameState.range);

  // 从队列头部取出第一道"旧题"（用户现在需要回答它）
  gameState.expectedQuestion = gameState.queue[0];

  // 更新答题UI
  updateAnswerUI();
}

/**
 * 更新答题阶段UI：
 * - 显示旧题（用户要回答的题目）
 * - 显示新题（用户要记住的题目）
 * - 清空输入显示
 */
function updateAnswerUI() {
  // 显示旧题（需要回答的题）——数字用大问号遮盖，运算符用小问号遮盖
  // 玩家必须纯粹凭记忆回想题目和答案
  var masked = maskQuestion(gameState.expectedQuestion);
  document.getElementById('old-question-display').innerHTML = masked;

  // 显示新题文本（用户需要记住的题）——完整展示
  document.getElementById('new-question-display').textContent =
    gameState.currentNewQuestion.display;

  // 清空输入
  gameState.currentInput = '';
  document.getElementById('answer-input-display').textContent = '___';
}

/**
 * 将题目的数字和运算符用问号遮盖
 * 数字 → 大问号，运算符 → 小问号，保留 "= ？" 结构
 * @param {Object} question - 题目对象 {a, b, operator}
 * @returns {string} 带 HTML 标签的遮盖后文本
 */
function maskQuestion(question) {
  var bigMark = '<span class="masked-number">？</span>';
  var smallMark = '<span class="masked-operator">？</span>';
  return bigMark + ' ' + smallMark + ' ' + bigMark + ' = ？';
}

/**
 * 用户通过数字键盘输入数字
 * @param {string} digit - 单个数字字符 '0'~'9'
 */
function inputDigit(digit) {
  // 仅在答题阶段接受输入
  if (gameState.phase !== PHASE.ANSWER) return;

  // 限制输入长度（最多6位，防止过长）
  if (gameState.currentInput.length >= 6) return;

  // 首位不能连续输入0
  if (gameState.currentInput === '0' && digit === '0') return;
  // 替换前导0
  if (gameState.currentInput === '0' && digit !== '0') {
    gameState.currentInput = digit;
  } else {
    gameState.currentInput += digit;
  }

  // 更新输入显示
  document.getElementById('answer-input-display').textContent = gameState.currentInput;
}

/**
 * 删除最后一位输入
 */
function deleteDigit() {
  if (gameState.phase !== PHASE.ANSWER) return;

  gameState.currentInput = gameState.currentInput.slice(0, -1);
  if (gameState.currentInput === '') {
    document.getElementById('answer-input-display').textContent = '___';
  } else {
    document.getElementById('answer-input-display').textContent = gameState.currentInput;
  }
}

/**
 * 用户点击确认按钮，提交答案
 */
function submitAnswer() {
  // 仅在答题阶段接受提交
  if (gameState.phase !== PHASE.ANSWER) return;

  // 输入为空时忽略
  if (gameState.currentInput === '') return;

  var userAnswer = parseInt(gameState.currentInput, 10);
  checkAnswer(userAnswer);
}


// ================================================================
// 六、答题逻辑与计分
// ================================================================

/**
 * 核对用户答案
 * @param {number} userAnswer - 用户输入的答案
 */
function checkAnswer(userAnswer) {
  var correctAnswer = gameState.expectedQuestion.answer;

  if (userAnswer === correctAnswer) {
    // ===== 答对 =====
    gameState.score++;
    updateScoreDisplay();

    // 将当前新题加入队列尾部（用户需要记住它）
    // 移除队列头部（刚刚答过的旧题）
    gameState.queue.shift();
    gameState.queue.push(gameState.currentNewQuestion);

    // 生成下一道新题
    gameState.currentNewQuestion = generateQuestion(gameState.range);

    // 下一道需要回答的旧题（队列新的头部）
    gameState.expectedQuestion = gameState.queue[0];

    // 刷新答题界面
    updateAnswerUI();

    // 播放答对反馈（简短闪烁）
    flashCorrect();
  } else {
    // ===== 答错：游戏结束 =====
    endGame({
      question: gameState.expectedQuestion.display,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer
    });
  }
}

/**
 * 答对时的短暂视觉反馈
 */
function flashCorrect() {
  var display = document.getElementById('answer-input-display');
  display.style.color = '#27AE60';
  setTimeout(function () {
    display.style.color = '';
  }, 200);
}


// ================================================================
// 七、游戏结束
// ================================================================

/**
 * 游戏结束处理
 * @param {Object|null} wrongInfo - 错误信息（答错时传入）
 * @param {string} wrongInfo.question - 错题文本
 * @param {number} wrongInfo.userAnswer - 用户答案
 * @param {number} wrongInfo.correctAnswer - 正确答案
 */
function endGame(wrongInfo) {
  gameState.phase = PHASE.END;

  // 清理定时器
  clearGameTimers();

  // 保存分数到 localStorage
  saveScore(gameState.mode, gameState.score);

  // 获取最高分
  var highScore = getHighScore(gameState.mode);

  // 更新弹窗UI
  document.getElementById('result-score').textContent = gameState.score;
  document.getElementById('result-highscore').textContent = highScore;

  // 显示错误详情（如果因为答错而结束）
  var errorDetail = document.getElementById('error-detail');
  if (wrongInfo) {
    errorDetail.classList.remove('hidden');
    document.getElementById('error-question').textContent = wrongInfo.question;
    document.getElementById('error-user-answer').textContent = wrongInfo.userAnswer;
    document.getElementById('error-correct-answer').textContent = wrongInfo.correctAnswer;
    document.getElementById('modal-icon').textContent = '😢';
  } else {
    errorDetail.classList.add('hidden');
  }

  // 显示弹窗
  document.getElementById('modal-overlay').classList.remove('hidden');
}

/**
 * 重新开始游戏（从结束弹窗）
 */
function retryGame() {
  document.getElementById('modal-overlay').classList.add('hidden');
  if (gameState.mode) {
    startGame(gameState.mode);
  }
}

/**
 * 清理所有定时器
 */
function clearGameTimers() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
  // 重置倒计时圆圈样式
  var circle = document.getElementById('countdown-circle');
  if (circle) {
    circle.classList.remove('danger', 'warning');
  }
}


// ================================================================
// 八、本地存储（localStorage）读写函数
// ================================================================

/** localStorage 键名 */
var STORAGE_KEY = 'yisuan_leaderboard';

/**
 * 获取全部排行榜数据
 * @returns {Object} 排行榜数据结构
 */
function getLeaderboard() {
  try {
    var data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    // 数据损坏时静默重置
    console.warn('排行榜数据解析失败，已重置', e);
  }
  // 返回默认数据结构
  return {
    simple: { highScore: 0, history: [] },
    medium: { highScore: 0, history: [] },
    hard: { highScore: 0, history: [] },
    custom: { highScore: 0, history: [] }
  };
}

/**
 * 获取指定模式的最高分
 * @param {string} mode - 模式名称
 * @returns {number} 最高分
 */
function getHighScore(mode) {
  var data = getLeaderboard();
  return data[mode] ? data[mode].highScore : 0;
}

/**
 * 保存一局得分记录
 * @param {string} mode - 模式名称
 * @param {number} score - 本局得分
 */
function saveScore(mode, score) {
  var data = getLeaderboard();

  // 确保该模式数据结构存在
  if (!data[mode]) {
    data[mode] = { highScore: 0, history: [] };
  }

  // 更新最高分
  if (score > data[mode].highScore) {
    data[mode].highScore = score;
  }

  // 添加历史记录（最新在前）
  data[mode].history.unshift({
    score: score,
    time: new Date().toISOString()
  });

  // 限制历史记录数量（最多保留100条）
  if (data[mode].history.length > 100) {
    data[mode].history = data[mode].history.slice(0, 100);
  }

  // 写入 localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // 存储空间不足时提示
    showToast('存储空间不足，请清理历史记录');
    console.error('localStorage 写入失败', e);
  }
}

/**
 * 清空全部排行榜数据
 * @returns {boolean} 是否成功
 */
function clearLeaderboard() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('清空数据失败', e);
    return false;
  }
}


// ================================================================
// 九、页面导航与UI辅助函数
// ================================================================

/**
 * 切换到指定页面
 * @param {string} pageId - 页面ID：'home' | 'game' | 'custom' | 'leaderboard'
 */
function showPage(pageId) {
  // 隐藏所有页面
  var pages = document.querySelectorAll('.page');
  pages.forEach(function (p) {
    p.classList.remove('active');
  });

  // 显示目标页面
  var target = document.getElementById('page-' + pageId);
  if (target) {
    target.classList.add('active');
  }

  // 隐藏弹窗（页面切换时）
  document.getElementById('modal-overlay').classList.add('hidden');

  // 清理游戏定时器（离开游戏页时）
  if (pageId !== 'game') {
    clearGameTimers();
    gameState.phase = PHASE.IDLE;
  }
}

/**
 * 返回首页
 */
function showHome() {
  showPage('home');
}

/**
 * 中途退出游戏，返回首页
 */
function quitGame() {
  if (gameState.phase === PHASE.IDLE) return;
  if (gameState.phase !== PHASE.END) {
    // 游戏进行中退出，不保存分数
    clearGameTimers();
    gameState.phase = PHASE.IDLE;
  }
  // 隐藏弹窗（如果有）
  document.getElementById('modal-overlay').classList.add('hidden');
  showPage('home');
}

/**
 * 显示自定义设置页
 */
function showCustomSettings() {
  showPage('custom');
  // 同步滑块和显示值
  document.getElementById('custom-count-slider').value = customSettings.count;
  document.getElementById('custom-count-display').textContent = customSettings.count;
  // 同步范围选择按钮
  updateRangeButtons();
}

/**
 * 自定义设置：更新预记题数
 * @param {string|number} value - 滑条值
 */
function updateCustomCount(value) {
  var count = parseInt(value, 10);
  customSettings.count = count;
  document.getElementById('custom-count-display').textContent = count;
}

/**
 * 自定义设置：选择题数范围
 * @param {string} range - 'ten' | 'hundred'
 * @param {HTMLElement} btn - 被点击的按钮
 */
function selectRange(range, btn) {
  customSettings.range = range;
  updateRangeButtons();
}

/**
 * 更新范围选择按钮的选中状态
 */
function updateRangeButtons() {
  var buttons = document.querySelectorAll('.btn-range');
  buttons.forEach(function (btn) {
    if (btn.getAttribute('data-range') === customSettings.range) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

/**
 * 更新得分显示
 */
function updateScoreDisplay() {
  var scoreEl = document.getElementById('game-score');
  scoreEl.innerHTML = '得分：<strong>' + gameState.score + '</strong>';
}

/**
 * 显示 Toast 提示
 * @param {string} message - 提示文字
 * @param {number} duration - 显示时长（毫秒），默认2000
 */
function showToast(message, duration) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');

  duration = duration || 2000;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(function () {
    toast.classList.add('hidden');
  }, duration);
}


// ================================================================
// 十、排行榜页面
// ================================================================

/** 排行榜当前选中的模式Tab */
var currentLeaderboardTab = 'simple';

/**
 * 显示排行榜页面
 */
function showLeaderboard() {
  showPage('leaderboard');
  currentLeaderboardTab = 'simple';
  // 重置Tab选中状态
  var tabs = document.querySelectorAll('.leaderboard-tabs .tab-btn');
  tabs.forEach(function (t) { t.classList.remove('active'); });
  var firstTab = document.querySelector('.leaderboard-tabs .tab-btn[data-tab="simple"]');
  if (firstTab) firstTab.classList.add('active');
  // 渲染排行榜
  renderLeaderboard('simple');
}

/**
 * 切换排行榜模式Tab
 * @param {string} mode - 模式名称
 * @param {HTMLElement} btn - 被点击的Tab按钮
 */
function switchLeaderboardTab(mode, btn) {
  currentLeaderboardTab = mode;
  // 更新Tab选中状态
  var tabs = document.querySelectorAll('.leaderboard-tabs .tab-btn');
  tabs.forEach(function (t) { t.classList.remove('active'); });
  btn.classList.add('active');
  // 渲染对应模式数据
  renderLeaderboard(mode);
}

/**
 * 渲染排行榜内容
 * @param {string} mode - 模式名称
 */
function renderLeaderboard(mode) {
  var data = getLeaderboard();
  var modeData = data[mode] || { highScore: 0, history: [] };

  // 更新最高分
  document.getElementById('lb-highscore').textContent = modeData.highScore;

  // 更新历史记录列表
  var listEl = document.getElementById('history-list');
  var history = modeData.history || [];

  if (history.length === 0) {
    listEl.innerHTML = '<li class="history-empty">暂无记录</li>';
  } else {
    var html = '';
    history.forEach(function (record) {
      var timeStr = formatTime(record.time);
      html += '<li class="history-item">' +
        '<span class="history-score">' + record.score + ' 分</span>' +
        '<span class="history-time">' + timeStr + '</span>' +
        '</li>';
    });
    listEl.innerHTML = html;
  }
}

/**
 * 格式化时间字符串
 * @param {string} isoString - ISO 时间字符串
 * @returns {string} 格式化后的时间 如 "07-14 15:30"
 */
function formatTime(isoString) {
  try {
    var d = new Date(isoString);
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    return month + '-' + day + ' ' + hours + ':' + minutes;
  } catch (e) {
    return '--';
  }
}

/**
 * 处理清空排行榜按钮点击
 */
function handleClearLeaderboard() {
  var confirmed = confirm('确定要清空全部排行榜数据吗？此操作不可恢复！');
  if (confirmed) {
    clearLeaderboard();
    renderLeaderboard(currentLeaderboardTab);
    showToast('排行榜数据已清空');
  }
}


// ================================================================
// 十一、PWA 与初始化
// ================================================================

/**
 * 注册 Service Worker（用于 PWA 离线缓存）
 * 注意：file:// 协议下 SW 无法注册，仅在 http(s):// 下生效
 * Pake-Plus 打包后，SW 同样不适用（App 本地加载无需 SW）
 * 此处面向 Web 端 PWA 场景
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // 仅在 http/https 协议下注册（file 协议会抛异常）
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      navigator.serviceWorker.register('./sw.js')
        .then(function (registration) {
          console.log('[PWA] Service Worker 注册成功', registration.scope);
        })
        .catch(function (error) {
          console.log('[PWA] Service Worker 注册失败（可能在file协议下）', error.message);
        });
    }
  }
}

/**
 * 页面加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', function () {
  // 注册 Service Worker
  registerServiceWorker();

  // 确保初始显示首页
  showPage('home');

  // 初始化自定义设置滑块显示
  document.getElementById('custom-count-slider').value = customSettings.count;
  document.getElementById('custom-count-display').textContent = customSettings.count;
  updateRangeButtons();

  console.log('🧮 忆算 - 记忆算术挑战 已就绪');
  console.log('   简单(3题) | 中等(6题) | 困难(9题) | 自定义(1~20题)');
  console.log('   支持 PWA 离线运行 | Pake-Plus 打包');
});
