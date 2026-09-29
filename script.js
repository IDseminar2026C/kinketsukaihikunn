// 入力欄のIDの一覧
const inputIds = ["income", "fixed", "goal", "days", "food", "social", "misc"];

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

  const resultValue = document.getElementById("result-value");
  const resultMessage = document.getElementById("result-message");

  // 残り日数が 0 以下のときは割り算できないので計算しない
  if (days <= 0) {
    resultValue.textContent = "---";
    resultMessage.textContent = "残り日数を入力してください";
    return;
  }

  // 本日の防衛ライン = 残金 ÷ 残り日数（端数切り捨て）
  const dailyLimit = Math.floor(remaining / days);

  resultValue.textContent = dailyLimit.toLocaleString();
  resultMessage.textContent = "使える残金：" + remaining.toLocaleString() + " 円";
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

// どの入力欄が変わっても、すぐに再計算する
inputIds.forEach(function (id) {
  document.getElementById(id).addEventListener("input", calculate);
});

setRemainingDays();
calculate();
