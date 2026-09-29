// 入力欄のIDの一覧（変わったらすぐ再計算する欄）
const inputIds = ["income", "fixed", "goal", "days", "savings"];

// 保存する入力欄（残り日数は毎回今日から計算し直すので保存しない）
const saveIds = ["income", "fixed", "goal", "savings"];

// 月が変わったときに消す入力欄（固定費・目標額・貯金額は翌月に引き継ぐので消さない）
const resetIds = ["income"];

// localStorage に保存するときのキー
const STORAGE_KEY = "kinketsu";

// 防衛ラインがこの金額以下なら危険（赤く光らせる）
const DANGER_LINE = 1000;

// 防衛ラインがこの金額未満なら警戒（オレンジ）
const WARNING_LINE = 2000;

// 防衛ラインがこの金額未満なら注意（黄色）
const CAUTION_LINE = 3000;

// 段階ごとに結果カードへ付けるクラス名
const LEVEL_CLASSES = ["danger", "warning", "caution", "safe"];

// 支出カテゴリの表示名
const CATEGORY_NAMES = {
  food: "食費",
  social: "交際費",
  misc: "雑費"
};

// 出費の記録の一覧 { id, category, amount, date }
let expenses = [];

// 場所ごとの残高の一覧 { id, name, amount }
let balances = [];

// 修正中の記録の id（修正していないときは null）
let editingExpenseId = null;
let editingBalanceId = null;

// データを最後に使った月（例："2026-09"）。まだ分からないときは null
let savedMonth = null;

// 入力欄の値を数値で取り出す（空欄やおかしな値は 0 として扱う）
function getNumber(id) {
  const value = Number(document.getElementById(id).value);
  if (isNaN(value) || value < 0) {
    return 0;
  }
  return value;
}

// 記録用の金額欄を読み取る（min 円より少ない・空欄・おかしな値のときは null を返す）
function readAmount(id, min) {
  const text = document.getElementById(id).value;
  const value = Math.floor(Number(text));
  if (text === "" || isNaN(value) || value < min) {
    return null;
  }
  return value;
}

// 記録ごとに別々の id を作る（同じミリ秒に2回押されても重ならないように乱数も付ける）
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 一覧の中から id が一致する記録を探す
function findById(list, id) {
  return list.find(function (item) {
    return item.id === id;
  });
}

// 一覧の中から名前が同じ場所を探す（exceptId の場所は探さない）
function findByName(name, exceptId) {
  const key = normalizeName(name);
  return balances.find(function (item) {
    return item.id !== exceptId && normalizeName(item.name) === key;
  });
}

// 名前を比べやすい形にする（全角・半角、大文字・小文字の違いをなくす）
function normalizeName(name) {
  return name.normalize("NFKC").toLowerCase().trim();
}

// 入力欄の下にお知らせを出す（isError が true なら赤い文字、false なら緑の文字）
function showFormMessage(id, text, isError) {
  const message = document.getElementById(id);
  message.textContent = text;
  message.classList.toggle("info", !isError);
}

// 今日の日付を「9/29」の形で返す
function getTodayText() {
  const today = new Date();
  return (today.getMonth() + 1) + "/" + today.getDate();
}

// 今の月を「2026-09」の形で返す
function getMonthKey() {
  const today = new Date();
  return today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
}

// 出費の記録の合計（総出費）を求める
function getExpenseTotal() {
  let total = 0;
  expenses.forEach(function (item) {
    total += item.amount;
  });
  return total;
}

// 防衛ラインを計算して画面に表示する
function calculate() {
  const income = getNumber("income");
  const fixed = getNumber("fixed");
  const goal = getNumber("goal");
  const days = Math.floor(getNumber("days"));
  const savings = getNumber("savings");
  const useSavings = document.getElementById("use-savings").checked;

  // 総出費 = 記録した出費の合計
  const totalExpense = getExpenseTotal();

  // 本当に使える残金 = 収入 - 固定費 - 目標額 - 総出費（チェックありなら貯金も足す）
  let remaining = income - fixed - goal - totalExpense;
  if (useSavings) {
    remaining += savings;
  }

  const resultCard = document.getElementById("result-card");
  const resultValue = document.getElementById("result-value");
  const resultRemaining = document.getElementById("result-remaining");
  const resultSavings = document.getElementById("result-savings");
  const resultMessage = document.getElementById("result-message");

  // いったん段階の表示を外してから判定し直す
  resultCard.classList.remove(...LEVEL_CLASSES);
  document.body.classList.remove("bankrupt");

  // 収入が未入力のときは計算しない（最初から危険表示にならないように）
  if (document.getElementById("income").value === "") {
    resultValue.textContent = "---";
    resultRemaining.textContent = "";
    resultSavings.textContent = "";
    resultMessage.textContent = "収入を入力してください";
    return;
  }

  // 残り日数が 0 以下のときは割り算できないので計算しない
  if (days <= 0) {
    resultValue.textContent = "---";
    resultRemaining.textContent = "";
    resultSavings.textContent = "";
    resultMessage.textContent = "残り日数を入力してください";
    return;
  }

  // 本日の防衛ライン = 残金 ÷ 残り日数（端数切り捨て）
  const dailyLimit = Math.floor(remaining / days);

  resultValue.textContent = dailyLimit.toLocaleString();
  resultRemaining.textContent = "使える残金：" + remaining.toLocaleString() + " 円";
  resultSavings.textContent = getSavingsText(savings, useSavings);
  resultMessage.textContent = getMessage(dailyLimit, remaining);

  // 段階に応じて結果カードの色を変える（危険のときだけ赤く光らせる）
  resultCard.classList.add(getLevel(dailyLimit, remaining));

  // 破産（残金マイナス）のときは背景にどくろを出す
  if (remaining < 0) {
    document.body.classList.add("bankrupt");
  }
}

// 防衛ラインの段階を返す（danger / warning / caution / safe）
function getLevel(dailyLimit, remaining) {
  if (remaining < 0 || dailyLimit <= DANGER_LINE) {
    return "danger";
  }
  if (dailyLimit < WARNING_LINE) {
    return "warning";
  }
  if (dailyLimit < CAUTION_LINE) {
    return "caution";
  }
  return "safe";
}

// 貯金を計算に含めているかどうかを知らせる文を返す
function getSavingsText(savings, useSavings) {
  if (useSavings) {
    return "前月までの貯金 " + savings.toLocaleString() + " 円を含めて計算中";
  }
  if (savings > 0) {
    return "前月までの貯金 " + savings.toLocaleString() + " 円は計算に含めていません";
  }
  return "";
}

// 防衛ラインの状況に応じたメッセージを返す（段階 ＋ サバイバル称号 ＋ ひとこと）
function getMessage(dailyLimit, remaining) {
  if (remaining < 0) {
    return "【破産】☠️『GAMEOVER / 無』\n「給料日まで息を潜めよ」";
  }
  if (dailyLimit <= DANGER_LINE) {
    return "【危険】🚨『瀕死のサバイバー』\n「水と日光で生きろ」";
  }
  if (dailyLimit < WARNING_LINE) {
    return "【警戒】⚠️『もやし生活予備軍』\n「自炊の時が来た」";
  }
  if (dailyLimit < CAUTION_LINE) {
    return "【注意】🛡️『一般市民』\n「平和な日常だ」";
  }
  return "【安全】👑『石油王の余裕』\n「うまいもん食え！」";
}

// 今日を含めた、今月の残り日数を求める
function getRemainingDays() {
  const today = new Date();
  // 翌月の0日 = 今月の最終日
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return lastDay - today.getDate() + 1;
}

// 残り日数の欄に、今日から自動計算した日数を入れる（あとから手で直せる）
function setRemainingDays() {
  const today = new Date();
  document.getElementById("days").value = getRemainingDays();
  document.getElementById("days-note").textContent =
    "今日（" + (today.getMonth() + 1) + "/" + today.getDate() + "）から月末までを自動で入れました";
}

// 一覧の1行を作る（texts は左から順に並べる文字、isEditing が true なら修正中の色にする）
function createRow(texts, isEditing, onEdit, onDelete) {
  const li = document.createElement("li");
  if (isEditing) {
    li.classList.add("editing");
  }

  texts.forEach(function (text) {
    const span = document.createElement("span");
    span.className = text.className;
    span.textContent = text.value;
    li.appendChild(span);
  });

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "small-button";
  editButton.textContent = "修正";
  editButton.addEventListener("click", onEdit);
  li.appendChild(editButton);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "small-button delete";
  deleteButton.textContent = "削除";
  deleteButton.addEventListener("click", onDelete);
  li.appendChild(deleteButton);

  return li;
}

// 出費の一覧とカテゴリ別の合計を表示し直す
function renderExpenses() {
  const list = document.getElementById("expense-list");
  list.innerHTML = "";

  const totals = { food: 0, social: 0, misc: 0 };

  // 新しい記録が上に来るように、後ろから順に並べる
  expenses.slice().reverse().forEach(function (item) {
    totals[item.category] += item.amount;
    list.appendChild(createRow(
      [
        { className: "entry-date", value: item.date },
        { className: "entry-name", value: CATEGORY_NAMES[item.category] },
        { className: "entry-amount", value: item.amount.toLocaleString() + " 円" }
      ],
      item.id === editingExpenseId,
      function () { startEditExpense(item.id); },
      function () { deleteExpense(item.id); }
    ));
  });

  document.getElementById("food-total").textContent = totals.food.toLocaleString();
  document.getElementById("social-total").textContent = totals.social.toLocaleString();
  document.getElementById("misc-total").textContent = totals.misc.toLocaleString();
  document.getElementById("expense-total").textContent = getExpenseTotal().toLocaleString();
}

// 「記録する」「更新する」ボタン：出費を追加する、または修正中の記録を書き換える
function submitExpense() {
  const category = document.getElementById("expense-category").value;
  const amount = readAmount("expense-amount", 1);
  if (amount === null) {
    showFormMessage("expense-error", "金額は1円以上の数字で入力してください", true);
    return;
  }

  // 新しく記録したときだけダメージ演出を出す（修正のときは出さない）
  const isNew = editingExpenseId === null;

  if (isNew) {
    expenses.push({ id: createId(), category: category, amount: amount, date: getTodayText() });
  } else {
    const item = findById(expenses, editingExpenseId);
    if (item) {
      item.category = category;
      item.amount = amount;
    }
  }

  clearExpenseForm();
  refresh();

  if (isNew) {
    showDamage(amount);
  }
}

// 出費を記録した瞬間の「ダメージ」演出（画面の揺れ・赤いフラッシュ・ダメージ数字）
function showDamage(amount) {
  // 画面を揺らす（連続で記録しても毎回揺れるように、一度外してから付け直す）
  const container = document.querySelector(".container");
  container.classList.remove("damage-shake");
  void container.offsetWidth;
  container.classList.add("damage-shake");

  // 画面のふちを赤く光らせる
  const flash = document.createElement("div");
  flash.className = "damage-flash";
  document.body.appendChild(flash);

  // ダメージ数字を飛び出させる
  const number = document.createElement("div");
  number.className = "damage-number";
  number.textContent = "-" + amount.toLocaleString();
  document.body.appendChild(number);

  // アニメーションが終わったら消す
  [flash, number].forEach(function (element) {
    element.addEventListener("animationend", function () {
      element.remove();
    });
  });
}

// 「修正」ボタン：記録の内容を入力欄に戻して、修正できる状態にする
function startEditExpense(id) {
  const item = findById(expenses, id);
  if (!item) {
    return;
  }
  editingExpenseId = id;
  document.getElementById("expense-category").value = item.category;
  document.getElementById("expense-amount").value = item.amount;
  document.getElementById("expense-error").textContent = "";
  document.getElementById("expense-add").textContent = "更新する";
  document.getElementById("expense-cancel").hidden = false;
  document.getElementById("expense-amount").focus();
  renderExpenses();
}

// 「削除」ボタン：確認してから記録を消す
function deleteExpense(id) {
  if (!confirm("この記録を削除します。よろしいですか？")) {
    return;
  }
  expenses = expenses.filter(function (item) {
    return item.id !== id;
  });
  // 修正中の記録を消したときは、入力欄も元に戻す
  if (editingExpenseId === id) {
    clearExpenseForm();
  }
  refresh();
}

// 出費の入力欄を空にして、「記録する」の状態に戻す
function clearExpenseForm() {
  editingExpenseId = null;
  document.getElementById("expense-amount").value = "";
  document.getElementById("expense-error").textContent = "";
  document.getElementById("expense-add").textContent = "記録する";
  document.getElementById("expense-cancel").hidden = true;
}

// 場所ごとの残高の一覧と合計を表示し直す
function renderBalances() {
  const list = document.getElementById("balance-list");
  list.innerHTML = "";

  let total = 0;
  balances.forEach(function (item) {
    total += item.amount;
    list.appendChild(createRow(
      [
        { className: "entry-name", value: item.name },
        { className: "entry-amount", value: item.amount.toLocaleString() + " 円" }
      ],
      item.id === editingBalanceId,
      function () { startEditBalance(item.id); },
      function () { deleteBalance(item.id); }
    ));
  });

  document.getElementById("balance-total").textContent = total.toLocaleString();
  renderWithdrawPlaces();
}

// 「減ったとき」の場所のプルダウンを、登録済みの場所で作り直す
function renderWithdrawPlaces() {
  const select = document.getElementById("withdraw-place");
  const selectedId = select.value;
  select.innerHTML = "";

  if (balances.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "先に場所を追加してください";
    select.appendChild(option);
  }

  balances.forEach(function (item) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });

  // 作り直す前に選んでいた場所があれば、選んだままにする
  if (findById(balances, selectedId)) {
    select.value = selectedId;
  }

  const isEmpty = balances.length === 0;
  select.disabled = isEmpty;
  document.getElementById("withdraw-amount").disabled = isEmpty;
  document.getElementById("withdraw-button").disabled = isEmpty;
}

// 「足す」「更新する」ボタン：残高を足す（同じ名前の場所があれば積み立てる）、または修正中の残高を書き換える
function submitBalance() {
  const name = document.getElementById("balance-name").value.trim();
  const amount = readAmount("balance-amount", 0);
  if (name === "") {
    showFormMessage("balance-error", "場所の名前を入力してください", true);
    return;
  }
  if (amount === null) {
    showFormMessage("balance-error", "金額は0円以上の数字で入力してください", true);
    return;
  }

  let message;
  if (editingBalanceId === null) {
    const sameItem = findByName(name, null);
    if (sameItem) {
      sameItem.amount += amount;
      message = sameItem.name + " に " + amount.toLocaleString() + " 円を足しました（合計 " + sameItem.amount.toLocaleString() + " 円）";
    } else {
      balances.push({ id: createId(), name: name, amount: amount });
      message = name + " を追加しました";
    }
  } else {
    // 修正でほかの場所と同じ名前にはできない
    if (findByName(name, editingBalanceId)) {
      showFormMessage("balance-error", "同じ名前の場所がすでにあります", true);
      return;
    }
    const item = findById(balances, editingBalanceId);
    if (item) {
      item.name = name;
      item.amount = amount;
    }
    message = name + " の残高を " + amount.toLocaleString() + " 円に直しました";
  }

  clearBalanceForm();
  refresh();
  showFormMessage("balance-error", message, false);
}

// 「引く」ボタン：選んだ場所の残高から金額を引く
function withdrawBalance() {
  const item = findById(balances, document.getElementById("withdraw-place").value);
  const amount = readAmount("withdraw-amount", 1);
  if (!item) {
    showFormMessage("withdraw-error", "場所を選んでください", true);
    return;
  }
  if (amount === null) {
    showFormMessage("withdraw-error", "金額は1円以上の数字で入力してください", true);
    return;
  }
  if (amount > item.amount) {
    showFormMessage("withdraw-error", "残高が足りません（" + item.name + "：" + item.amount.toLocaleString() + " 円）", true);
    return;
  }

  item.amount -= amount;
  // 同じ場所を修正中だったときは、古い金額で上書きしないように修正をやめる
  if (editingBalanceId === item.id) {
    clearBalanceForm();
  }
  document.getElementById("withdraw-amount").value = "";
  refresh();
  showFormMessage("withdraw-error", item.name + " から " + amount.toLocaleString() + " 円を引きました（残り " + item.amount.toLocaleString() + " 円）", false);
}

// 「修正」ボタン：残高の内容を入力欄に戻して、修正できる状態にする
function startEditBalance(id) {
  const item = findById(balances, id);
  if (!item) {
    return;
  }
  editingBalanceId = id;
  document.getElementById("balance-name").value = item.name;
  document.getElementById("balance-amount").value = item.amount;
  document.getElementById("balance-error").textContent = "";
  document.getElementById("balance-add").textContent = "更新する";
  document.getElementById("balance-cancel").hidden = false;
  document.getElementById("balance-amount").focus();
  renderBalances();
}

// 「削除」ボタン：確認してから残高を消す
function deleteBalance(id) {
  if (!confirm("この残高を削除します。よろしいですか？")) {
    return;
  }
  balances = balances.filter(function (item) {
    return item.id !== id;
  });
  if (editingBalanceId === id) {
    clearBalanceForm();
  }
  refresh();
}

// 残高の入力欄を空にして、「追加する」の状態に戻す
function clearBalanceForm() {
  editingBalanceId = null;
  document.getElementById("balance-name").value = "";
  document.getElementById("balance-amount").value = "";
  document.getElementById("balance-error").textContent = "";
  document.getElementById("balance-add").textContent = "足す";
  document.getElementById("balance-cancel").hidden = true;
}

// 入力値・記録・設定を localStorage に保存する
function saveData() {
  const data = {
    month: savedMonth,
    useSavings: document.getElementById("use-savings").checked,
    expenses: expenses,
    balances: balances
  };
  saveIds.forEach(function (id) {
    data[id] = document.getElementById(id).value;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // 保存できない環境（プライベートモードなど）では何もしない
  }
}

// localStorage から入力値・記録・設定を読み込んで、画面に戻す
function loadData() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    data = null;
  }
  if (!data) {
    return;
  }
  saveIds.forEach(function (id) {
    if (data[id] !== undefined) {
      document.getElementById(id).value = data[id];
    }
  });
  document.getElementById("use-savings").checked = data.useSavings === true;
  if (Array.isArray(data.expenses)) {
    expenses = data.expenses;
  }
  if (Array.isArray(data.balances)) {
    balances = data.balances;
  }
  if (typeof data.month === "string") {
    savedMonth = data.month;
  }
}

// 一覧・計算結果を表示し直して、保存する
function refresh() {
  renderExpenses();
  renderBalances();
  calculate();
  saveData();
}

// 月が変わっていたら、先月の残りを貯金に足してから今月のデータ（収入・出費の記録）を消す
function checkNewMonth() {
  const thisMonth = getMonthKey();

  // 月が保存されていない（初めて使う・古い形式のデータ）ときは、今月のデータとして扱う
  if (savedMonth === null) {
    savedMonth = thisMonth;
    return;
  }
  if (savedMonth === thisMonth) {
    return;
  }

  let message = (new Date().getMonth() + 1) + "月になったので、収入と出費の記録をリセットしました。";

  // 先月の残り = 収入 - 固定費 - 出費の合計（収入が未入力の月は、貯金額を変えない）
  if (document.getElementById("income").value !== "") {
    const leftover = getNumber("income") - getNumber("fixed") - getExpenseTotal();
    const newSavings = Math.max(0, getNumber("savings") + leftover);
    document.getElementById("savings").value = newSavings;
    if (leftover >= 0) {
      message += "先月の残り " + leftover.toLocaleString() + " 円を貯金に足しました（貯金 " + newSavings.toLocaleString() + " 円）。";
    } else {
      message += "先月は " + (-leftover).toLocaleString() + " 円使いすぎたので、貯金から引きました（貯金 " + newSavings.toLocaleString() + " 円）。";
    }
  }

  resetIds.forEach(function (id) {
    document.getElementById(id).value = "";
  });
  expenses = [];
  clearExpenseForm();
  savedMonth = thisMonth;

  document.getElementById("month-notice-text").textContent = message;
  document.getElementById("month-notice").hidden = false;

  setRemainingDays();
  refresh();
}

// 画面の読み込みが終わったら準備する
document.addEventListener("DOMContentLoaded", function () {
  // どの入力欄が変わっても、すぐに再計算して保存する
  inputIds.forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
      calculate();
      saveData();
    });
  });

  document.getElementById("use-savings").addEventListener("change", function () {
    calculate();
    saveData();
  });

  // 出費の記録
  document.getElementById("expense-add").addEventListener("click", submitExpense);
  document.getElementById("expense-cancel").addEventListener("click", function () {
    clearExpenseForm();
    renderExpenses();
  });
  document.getElementById("expense-amount").addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.isComposing) {
      submitExpense();
    }
  });

  // 場所ごとの残高
  document.getElementById("balance-add").addEventListener("click", submitBalance);
  document.getElementById("balance-cancel").addEventListener("click", function () {
    clearBalanceForm();
    renderBalances();
  });
  ["balance-name", "balance-amount"].forEach(function (id) {
    document.getElementById(id).addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.isComposing) {
        submitBalance();
      }
    });
  });
  document.getElementById("withdraw-button").addEventListener("click", withdrawBalance);
  document.getElementById("withdraw-amount").addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.isComposing) {
      withdrawBalance();
    }
  });

  // 月が変わったお知らせを閉じる
  document.getElementById("month-notice-close").addEventListener("click", function () {
    document.getElementById("month-notice").hidden = true;
  });

  // ページを開いたまま月が変わったときのために、画面に戻ってきたときにも確かめる
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      checkNewMonth();
    }
  });

  loadData();
  checkNewMonth();
  setRemainingDays();
  refresh();
});
