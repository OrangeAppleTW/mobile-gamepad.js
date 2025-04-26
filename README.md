# MobileGamepad.js

一個簡單的 JavaScript 函式庫，用於為 HTML5 Canvas 遊戲添加觸控覆蓋層。

## 功能

*   綁定到遊戲畫面的 HTML element (如果是 iframe 則需要實作處理接收器，可參考後面說明)。
*   創建全螢幕半透明遮罩，在遮罩上方顯示 element，調整寬度以適應螢幕寬度。
*   根據指定的按鍵添加虛擬按鈕（方向鍵、空白鍵、動作鍵 A、B、Z）。
*   當虛擬按鈕被按下/觸摸時，模擬鍵盤事件 (`keydown`, `keyup`)。
*   包含一個關閉按鈕，可輕鬆解除綁定並恢復原始狀態。
*   自包含：無外部 CSS 或圖片依賴。

## 設定

在您的 HTML 中引入 `mobile-gamepad.js` 文件：

```html
<script src="mobile-gamepad.js"></script>
```

## 使用方法

1.  **獲取您的 canvas 元素：**

    ```javascript
    const myCanvas = document.getElementById('gameCanvas');
    ```

2.  **定義您要綁定的按鍵：** (使用標準的 `KeyboardEvent.key` 值)

    ```javascript
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'A', 'Z'];
    // ' ' 代表空白鍵
    ```

3.  **創建 MobileGamepad 實例：**

    ```javascript
    const gamepad = new MobileGamepad(myCanvas, keys);
    ```
    也可以指定監聽事件的 element (請參閱API)

4.  **綁定遊戲手把：**

    ```javascript
    // 通常在點擊按鈕或在移動設備上調用
    gamepad.bind();
    ```

5.  **解除綁定遊戲手把：** (關閉按鈕會自動執行此操作，但您也可以通過編程方式調用)

    ```javascript
    gamepad.unbind();
    ```

## 範例

```html
<!DOCTYPE html>
<html>
<head>
    <title>MobileGamepad 範例</title>
    <style>
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; flex-direction: column; }
        canvas { border: 1px solid black; background-color: white; }
    </style>
</head>
<body>
    <canvas id="myGame" width="320" height="240"></canvas>
    <button id="bindBtn" style="margin-top: 20px;">啟用觸控</button>

    <script src="mobile-gamepad.js"></script>
    <script>
        const canvas = document.getElementById('myGame');
        const ctx = canvas.getContext('2d');
        let x = canvas.width / 2;
        let y = canvas.height / 2;

        // 簡單的繪圖函數
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'red';
            ctx.fillRect(x - 10, y - 10, 20, 20);
        }
        draw(); // 初始繪製

        // 監聽模擬的鍵盤事件
        window.addEventListener('keydown', (e) => {
            console.log('按鍵按下:', e.key);
            switch(e.key) {
                case 'ArrowUp': y -= 5; break;
                case 'ArrowDown': y += 5; break;
                case 'ArrowLeft': x -= 5; break;
                case 'ArrowRight': x += 5; break;
                case ' ': console.log('跳躍!'); break; // 空白鍵
                case 'A': console.log('動作 A!'); break;
                case 'Z': console.log('動作 Z!'); break;
            }
            // 確保玩家在邊界內
            x = Math.max(10, Math.min(canvas.width - 10, x));
            y = Math.max(10, Math.min(canvas.height - 10, y));
            draw(); // 移動後重繪
        });

         window.addEventListener('keyup', (e) => {
            console.log('按鍵釋放:', e.key);
        });


        // 設定 MobileGamepad
        const gamepadKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'A', 'Z'];
        const mobileGamepad = new MobileGamepad(canvas, gamepadKeys);

        // 點擊按鈕時綁定
        document.getElementById('bindBtn').addEventListener('click', () => {
            mobileGamepad.bind();
        });
    </script>
</body>
</html>
```

## API

### `new MobileGamepad(targetElement, keysToBind, listeningElement?)`

創建一個新的 MobileGamepad 實例。

*   `targetElement`: 要綁定遊戲手把覆蓋層的 HTML 元素（例如 `<canvas>`、`<iframe>` 或甚至 `<div>`）。虛擬搖桿介面將相對於此元素或覆蓋層進行定位。
*   `keysToBind`: 一個字串陣列，代表要為其創建虛擬按鈕的按鍵。使用 `KeyboardEvent.key` 值（不區分大小寫）。常見的按鍵包括 `'ArrowUp'`, `'ArrowDown'`, `'ArrowLeft'`, `'ArrowRight'`, `' '`（空白鍵）以及單個字母，如 `'W'`, `'A'`, `'S'`, `'D'`, `'G'`, `'H'`, `'J'`, `'C'`。
*   `listeningElement` (可選): 應該接收模擬鍵盤事件的 `EventTarget`（例如 `HTMLElement`、`document` 或 `window`）。如果省略，事件將被派發到 `targetElement`（如果是 iframe，則 post 到它）。當實際的鍵盤事件監聽器附加到與遊戲手把視覺關聯的元素不同的元素上時（例如，在 `document` 上監聽全域按鍵），這非常有用。當 `targetElement` 是 `iframe` 時，此選項對於事件分派會被忽略，因為使用了 `postMessage`。

### `gamepad.bind()`

創建覆蓋層、按鈕，將目標元素移入覆蓋層（如果它不是 iframe），並將必要的事件監聽器附加到虛擬按鈕。

### `gamepad.unbind()`

移除覆蓋層和按鈕，將目標元素恢復到其在 DOM 中的原始位置（如果它被移動過），移除事件監聽器，並觸發 `'unbind'` 事件。

### `gamepad.on(eventName, callback)`

為特定事件註冊回呼函式。返回 gamepad 實例以供鏈式調用。

*   `eventName` (string): 要監聽的事件名稱。目前僅支援 `'unbind'`。
*   `callback` (function): 事件發生時要執行的函式。

## 使用 iframe 作為目標

當 `targetElement` 是 `<iframe>` 時，由於同源策略的限制，`MobileGamepad` 無法直接將鍵盤事件派發到 `iframe` 內部。在這種情況下，`MobileGamepad` 會改用 `window.postMessage` 將事件數據發送到 `iframe`。

**您需要在 `iframe` 內部的 JavaScript 中添加相應的代碼來接收這些消息並模擬鍵盤事件。**

以下是一個示例代碼，您可以將其添加到您的 `iframe` 頁面的 JavaScript 中：

```javascript
// 在 iframe 內部添加以下代碼
window.addEventListener('message', (event) => {
  // --- 安全性檢查 (重要!) ---
  // 驗證消息來源是否為您的主頁面
  // 將 'https://your-main-page-origin.com' 替換為您的主頁面實際的 origin
  // 例如：'http://localhost:8080' 或 'https://www.example.com'
  const expectedOrigin = 'https://your-main-page-origin.com';
  if (event.origin !== expectedOrigin) {
    console.warn('Received message from unexpected origin:', event.origin);
    return;
  }

  // --- 處理來自 MobileGamepad 的消息 ---
  if (event.data && event.data.type === 'keyboardEvent') {
    const { eventType, key } = event.data.payload;

    // 創建模擬的鍵盤事件
    // 注意: 某些瀏覽器或框架可能對模擬事件有特定要求
    const simulatedEvent = new KeyboardEvent(eventType, {
        key: key,
        bubbles: true, // 事件應該冒泡
        cancelable: true // 事件可以被取消
    });

    // --- 將事件派發給 iframe 中的目標元素 ---
    // 嘗試找到 iframe 內部真正需要接收鍵盤事件的元素
    // 將 'your-target-element-id-inside-iframe' 替換為您 iframe 內目標元素的 ID
    // 例如：遊戲的 <canvas> 或其他需要焦點的元素
    const targetInIframe = document.getElementById('your-target-element-id-inside-iframe');

    if (targetInIframe) {
      // 嘗試聚焦目標元素 (如果可聚焦)
      if (typeof targetInIframe.focus === 'function') {
          targetInIframe.focus();
      }
      targetInIframe.dispatchEvent(simulatedEvent);
      // console.log(`Dispatched ${eventType} ('${key}') to #your-target-element-id-inside-iframe`); // 調試信息
    } else {
      // 如果找不到特定目標，可以考慮派發給 iframe 的 document
      // 這對於全局快捷鍵可能有用
      document.dispatchEvent(simulatedEvent);
      // console.log(`Dispatched ${eventType} ('${key}') to iframe document`); // 調試信息
    }
  }
});
```

**重要提示:**

1.  **替換 `expectedOrigin`:** 務必將示例中的 `'https://your-main-page-origin.com'` 替換為您的主頁面（即包含 `MobileGamepad` 的頁面）的 **實際 origin**（協議 + 主機名 + 端口）。這是為了安全，防止來自未知來源的消息被處理。
2.  **替換 `your-target-element-id-inside-iframe`:** 將 `'your-target-element-id-inside-iframe'` 替換為您的 `iframe` 內部實際需要接收鍵盤事件的 HTML 元素的 ID。
3.  **測試:** 在不同的移動瀏覽器上充分測試以確保兼容性。

## 樣式

`MobileGamepad` 會動態注入一些基本樣式來佈局虛擬按鍵和鎖定頁面滾動。您可以通過修改實例的 `styles` 屬性來自定義外觀（建議在調用 `bind()` 之前進行）。

```javascript
// 在 bind() 之前修改樣式
gamepad.styles.dpadButton = `width: 60px; height: 60px; background-color: blue; /* ... 其他樣式 */`;
gamepad.styles.actionButton = `background-color: red; border-radius: 10px; /* ... */`;

gamepad.bind();
``` 