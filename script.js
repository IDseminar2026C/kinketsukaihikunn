// 入力欄のIDの一覧
const inputIds = ["income", "fixed", "goal", "days", "food", "social", "misc"];

// 保存する入力欄（残り日数は毎回今日から計算し直すので保存しない）
const saveIds = ["income", "fixed", "goal", "food", "social", "misc"];

// localStorage に保存するときのキー
const STORAGE_KEY = "kinketsu";

// 入力欄の値を数値で取り出す（空欄やおかしな値は 0 として扱う）
function getNumber(id) {
  const value = Number(document.getElementById(id).value);
  if (isNaN(value) || value < 0) {
    return 0;
  }
  return value;
}

// 防衛ラインを計算して画面に表示する
function calculate() {
  const income = getNumber("income");
  const fixed = getNumber("fixed");
  const goal = getNumber("goal");
  const days = Math.floor(getNumber("days"));

  // 総出費 = 各支出の合計
  const totalExpense = getNumber("food") + getNumber("social") + getNumber("misc");

  // 本当に使える残金 = 収入 - 固定費 - 目標額 - 総出費
  const remaining = income - fixed - goal - totalExpense;

  const resultCard = document.getElementById("result-card");
  const resultValue = document.getElementById("result-value");
  const resultRemaining = document.getElementById("result-remaining");
  const resultMessage = document.getElementById("result-message");

  // いったん危険表示を外してから判定し直す
  resultCard.classList.remove("danger");

  // 収入が未入力のときは計算しない（最初から危険表示にならないように）
  if (document.getElementById("income").value === "") {
    resultValue.textContent = "---";
    resultRemaining.textContent = "";
    resultMessage.textContent = "収入を入力してください";
    return;
  }

  // 残り日数が 0 以下のときは割り算できないので計算しない
  if (days <= 0) {
    resultValue.textContent = "---";
    resultRemaining.textContent = "";
    resultMessage.textContent = "残り日数を入力してください";
    return;
  }

  // 本日の防衛ライン = 残金 ÷ 残り日数（端数切り捨て）
  const dailyLimit = Math.floor(remaining / days);

  resultValue.textContent = dailyLimit.toLocaleString();
  resultRemaining.textContent = "使える残金：" + remaining.toLocaleString() + " 円";
  resultMessage.textContent = getMessage(dailyLimit, remaining);

  // 危険水域（防衛ライン500円以下 または 残金マイナス）なら結果カードだけ赤くする
  if (dailyLimit <= 500 || remaining < 0) {
    resultCard.classList.add("danger");
  }
}

// 防衛ラインの状況に応じたメッセージを返す
function getMessage(dailyLimit, remaining) {
  if (remaining < 0) {
    return "【破産】すでに目標額に手をつけています！今日から財布を封印してください！";
  }
  if (dailyLimit <= 500) {
    return "【危険】1日500円以下は水とパンの世界。コンビニに近づくな！";
  }
  if (dailyLimit < 1500) {
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

// 入力値を localStorage に保存する
function saveData() {
  const data = {};
  saveIds.forEach(function (id) {
    data[id] = document.getElementById(id).value;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // 保存できない環境（プライベートモードなど）では何もしない
  }
}

// localStorage から入力値を読み込んで、各入力欄に戻す
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
}

// 給料日リセット：確認してから全データを消す
function resetData() {
  if (!confirm("入力したデータをすべて消去します。よろしいですか？")) {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // 消せない環境では何もしない
  }
  saveIds.forEach(function (id) {
    document.getElementById(id).value = "";
  });
  setRemainingDays();
  calculate();
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

  document.getElementById("reset-button").addEventListener("click", resetData);

  loadData();
  setRemainingDays();
  calculate();
});
