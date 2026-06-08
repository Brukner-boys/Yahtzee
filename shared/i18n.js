(function (global) {
  'use strict';

  const dictionaries = {
    he: {
      'app.title': 'יאצי',
      'menu.title': 'יאצי — וריאציה רב-טורית',
      'menu.newGame': 'משחק חדש',
      'menu.mode.label': 'מצב משחק',
      'menu.mode.hotseat': 'מקומי (סבב על אותו מסך)',
      'menu.mode.vsAi': 'מול המחשב',
      'menu.aiSlotLabel': 'יריב מחשב',
      'menu.confirmNewGame': 'יש משחק שמור בתהליך. להתחיל משחק חדש (יוחלף)?',
      'menu.players': 'מספר שחקנים',
      'menu.columns': 'מספר טורים',
      'menu.aiLevel': 'רמת מחשב',
      'menu.aiLevel.easy': 'קל',
      'menu.aiLevel.medium': 'בינוני',
      'menu.aiLevel.hard': 'קשה',
      'menu.playerName': 'שם שחקן {n}',
      'menu.start': 'התחל משחק',
      'menu.resume': 'המשך משחק שמור',
      'menu.deleteSaved': 'מחק משחק שמור',
      'lang.toggle': 'EN',
      'board.roll': 'הטל',
      'board.rollAgain': 'הטל שוב',
      'board.rollsLeft': 'גלגולים: {n}/3',
      'board.turn': 'תור של {name}',
      'board.score': 'סך הכל',
      'board.bonus': 'בונוס',
      'board.upper': 'עליון',
      'board.lower': 'תחתון',
      'board.column': 'טור {n}',
      'board.dieHeld': 'מוחזקת',
      'board.dieFree': 'חופשית',
      'board.holdDie': 'החזק קובייה {n}',
      'board.selectCellHint': 'לחץ על תא ריק כדי לרשום',
      'board.extraTurn': 'יאצי! תור נוסף',
      'cat.ones': 'אחדים',
      'cat.twos': 'שניים',
      'cat.threes': 'שלשות',
      'cat.fours': 'רביעיות',
      'cat.fives': 'חמשיות',
      'cat.sixes': 'שישיות',
      'cat.threeOfKind': '3 מאותו סוג',
      'cat.fourOfKind': '4 מאותו סוג',
      'cat.fullHouse': 'מילוא',
      'cat.smallStraight': 'רצף קצר',
      'cat.largeStraight': 'רצף ארוך',
      'cat.yatzy': 'יאצי',
      'cat.chance': 'צ׳אנס',
      'end.title': 'המשחק הסתיים',
      'end.winner': 'המנצח: {name}',
      'end.scores': 'תוצאות סופיות',
      'end.newGame': 'משחק חדש',
      'errors.invalidMove': 'מהלך לא חוקי',
      'errors.cellTaken': 'תא תפוס',
      'errors.notYourTurn': 'לא תורך',
      'lobby.create': 'צור חדר',
      'lobby.join': 'הצטרף לחדר',
      'lobby.code': 'קוד חדר',
      'lobby.nickname': 'כינוי',
      'room.waiting': 'ממתינים לשחקנים',
      'room.startWhenReady': 'התחל כשמוכנים',
      'room.shareCode': 'שתף את הקוד:',
      'room.copy': 'העתק',
      'room.you': 'אתה',
      'room.owner': 'מארח',
      'room.offline': 'מנותק',
      'room.leave': 'יציאה',
      'room.waitingForHost': 'ממתין שהמארח יתחיל…',
      'room.connecting': 'מתחבר…',
      'room.disconnected': 'נותק. מנסה להתחבר מחדש…',
      'room.connected': 'מחובר',
      'room.serverError': 'שגיאת שרת: {message}',
      'room.notFound': 'החדר לא נמצא',
      'room.notJoinable': 'לא ניתן להצטרף לחדר (מלא או משחק כבר התחיל)',
    },
    en: {
      'app.title': 'Yatzi',
      'menu.title': 'Yatzi — Multi-Column Variant',
      'menu.newGame': 'New Game',
      'menu.mode.label': 'Game mode',
      'menu.mode.hotseat': 'Hot-seat (same screen)',
      'menu.mode.vsAi': 'Vs Computer',
      'menu.aiSlotLabel': 'Computer opponent',
      'menu.confirmNewGame': 'A game is in progress. Start a new game (the current will be discarded)?',
      'menu.players': 'Player count',
      'menu.columns': 'Columns',
      'menu.aiLevel': 'AI level',
      'menu.aiLevel.easy': 'Easy',
      'menu.aiLevel.medium': 'Medium',
      'menu.aiLevel.hard': 'Hard',
      'menu.playerName': 'Player {n} name',
      'menu.start': 'Start',
      'menu.resume': 'Resume saved game',
      'menu.deleteSaved': 'Delete saved game',
      'lang.toggle': 'עברית',
      'board.roll': 'Roll',
      'board.rollAgain': 'Roll again',
      'board.rollsLeft': 'Rolls: {n}/3',
      'board.turn': "{name}'s turn",
      'board.score': 'Total',
      'board.bonus': 'Bonus',
      'board.upper': 'Upper',
      'board.lower': 'Lower',
      'board.column': 'Column {n}',
      'board.dieHeld': 'Held',
      'board.dieFree': 'Free',
      'board.holdDie': 'Hold die {n}',
      'board.selectCellHint': 'Click an empty cell to score',
      'board.extraTurn': 'Yatzy! Extra turn',
      'cat.ones': 'Ones',
      'cat.twos': 'Twos',
      'cat.threes': 'Threes',
      'cat.fours': 'Fours',
      'cat.fives': 'Fives',
      'cat.sixes': 'Sixes',
      'cat.threeOfKind': '3 of a kind',
      'cat.fourOfKind': '4 of a kind',
      'cat.fullHouse': 'Full house',
      'cat.smallStraight': 'Small straight',
      'cat.largeStraight': 'Large straight',
      'cat.yatzy': 'Yatzy',
      'cat.chance': 'Chance',
      'end.title': 'Game over',
      'end.winner': 'Winner: {name}',
      'end.scores': 'Final scores',
      'end.newGame': 'New game',
      'errors.invalidMove': 'Invalid move',
      'errors.cellTaken': 'Cell already filled',
      'errors.notYourTurn': 'Not your turn',
      'lobby.create': 'Create room',
      'lobby.join': 'Join room',
      'lobby.code': 'Room code',
      'lobby.nickname': 'Nickname',
      'room.waiting': 'Waiting for players',
      'room.startWhenReady': 'Start when ready',
      'room.shareCode': 'Share this code:',
      'room.copy': 'Copy',
      'room.you': 'You',
      'room.owner': 'Host',
      'room.offline': 'Offline',
      'room.leave': 'Leave',
      'room.waitingForHost': 'Waiting for the host to start…',
      'room.connecting': 'Connecting…',
      'room.disconnected': 'Disconnected. Reconnecting…',
      'room.connected': 'Connected',
      'room.serverError': 'Server error: {message}',
      'room.notFound': 'Room not found',
      'room.notJoinable': 'Cannot join room (full or already started)',
    },
  };

  const DEFAULT_LANG = 'he';
  let currentLang = DEFAULT_LANG;

  function setLang(lang) {
    if (!dictionaries[lang]) throw new Error('unsupported lang: ' + lang);
    currentLang = lang;
  }

  function getLang() {
    return currentLang;
  }

  function dir(lang) {
    const l = lang || currentLang;
    return l === 'he' ? 'rtl' : 'ltr';
  }

  function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : '{' + k + '}'));
  }

  function t(key, params) {
    const dict = dictionaries[currentLang] || dictionaries[DEFAULT_LANG];
    const fallback = dictionaries[DEFAULT_LANG];
    const raw = dict[key] !== undefined ? dict[key] : fallback[key];
    if (raw === undefined) return key;
    return interpolate(raw, params);
  }

  function listLangs() {
    return Object.keys(dictionaries);
  }

  function hasKey(key) {
    return dictionaries[DEFAULT_LANG][key] !== undefined;
  }

  const api = { t, setLang, getLang, dir, listLangs, hasKey, DEFAULT_LANG };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Yatzi = global.Yatzi || {};
    global.Yatzi.i18n = api;
  }
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
