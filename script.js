// 入力欄のIDの一覧（変わったらすぐ再計算する欄）
const inputIds = ["income", "fixed", "goal", "days", "savings"];

// 保存する入力欄（残り日数は毎回今日から計算し直すので保存しない）
const saveIds = ["income", "fixed", "goal", "savings"];

// 給料日リセットで消す入力欄（貯金額は翌月に引き継ぐので消さない）
const resetIds = ["income", "fixed", "goal"];

// localStorage に保存するときのキー
const STORAGE_KEY = "kinketsu";

// 防衛ラインがこの金額以下なら危険（赤く光らせる）
const DANGER_LINE = 1000;

// 防衛ラインがこの金額未満なら注意
const CAUTION_LINE = 2000;

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

// 今日の日付を「9/29」の形で返す
function getTodayText() {
  const today = new Date();
  return (today.getMonth() + 1) + "/" + today.getDate();
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

  // いったん危険表示を外してから判定し直す
  resultCard.classList.remove("danger");

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

  // 危険水域（防衛ライン1000円以下 または 残金マイナス）なら結果カードだけ赤くする
  if (dailyLimit <= DANGER_LINE || remaining < 0) {
    resultCard.classList.add("danger");
  }
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

// 防衛ラインの状況に応じたメッセージを返す
function getMessage(dailyLimit, remaining) {
  if (remaining < 0) {
    return "【破産】すでに目標額に手をつけています！今日から財布を封印してください！";
  }
  if (dailyLimit <= DANGER_LINE) {
    return "【危険】1日" + DANGER_LINE + "円以下は水とパンの世界。コンビニに近づくな！";
  }
  if (dailyLimit < CAUTION_LINE) {
    return "【注意】余裕はあまりありません。外食や衝動買いは控えめに。";
  }
  return "【安全】このペースなら大丈夫。防衛ラインを守りましょう。";
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
    document.getElementById("expense-error").textContent = "金額は1円以上の数字で入力してください";
    return;
  }

  if (editingExpenseId === null) {
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
}

// 「追加する」「更新する」ボタン：残高を追加する、または修正中の残高を書き換える
function submitBalance() {
  const name = document.getElementById("balance-name").value.trim();
  const amount = readAmount("balance-amount", 0);
  const error = document.getElementById("balance-error");
  if (name === "") {
    error.textContent = "場所の名前を入力してください";
    return;
  }
  if (amount === null) {
    error.textContent = "金額は0円以上の数字で入力してください";
    return;
  }

  if (editingBalanceId === null) {
    balances.push({ id: createId(), name: name, amount: amount });
  } else {
    const item = findById(balances, editingBalanceId);
    if (item) {
      item.name = name;
      item.amount = amount;
    }
  }

  clearBalanceForm();
  refresh();
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
  document.getElementById("balance-add").textContent = "追加する";
  document.getElementById("balance-cancel").hidden = true;
}

// 入力値・記録・設定を localStorage に保存する
function saveData() {
  const data = {
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
}

// 一覧・計算結果を表示し直して、保存する
function refresh() {
  renderExpenses();
  renderBalances();
  calculate();
  saveData();
}

// 給料日リセット：確認してから今月のデータを消す（貯金額・設定・残高メモは残す）
function resetData() {
  if (!confirm("今月のデータ（収入・固定費・目標額・出費の記録）を消去します。\n前月までの貯金額と残高メモは残ります。よろしいですか？")) {
    return;
  }
  resetIds.forEach(function (id) {
    document.getElementById(id).value = "";
  });
  expenses = [];
  clearExpenseForm();
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

  document.getElementById("reset-button").addEventListener("click", resetData);

  loadData();
  setRemainingDays();
  refresh();
});
