// mobile-gamepad.js

class MobileGamepad {
    constructor(targetElement, keysToBind = [], listeningElement = null) {
        if (!targetElement || !(targetElement instanceof HTMLElement)) {
            throw new Error('MobileGamepad: 需要提供有效的 HTML 元素作為 targetElement。');
        }
        if (listeningElement && !(listeningElement instanceof EventTarget)) {
            throw new Error('MobileGamepad: listeningElement 必須是有效的 EventTarget (例如 HTMLElement, document, window)。');
        }
        this.targetElement = targetElement;
        this.listeningElement = listeningElement;
        this.keysToBind = new Set(keysToBind.map(key => key.toUpperCase())); // 標準化按鍵名稱 (包括 ' ' for space)
        this.bound = false;
        this.originalStyles = {}; // 用於存儲原始樣式、父元素等
        this.elements = {};
        this.touchStates = {};
        this.repeatIntervals = {}; // 新增: 用於存儲按鍵重複的 interval ID
        this.eventListeners = {}; // 新增: 用於存儲事件監聽器

        // 樣式ID，用於確保樣式只注入一次
        this._scrollLockStyleId = 'mobile-gamepad-scroll-lock-style';

        // --- 內部樣式定義 (調整佈局) ---
        this.styles = {
            overlay: `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.7); z-index: 9990; display: flex; flex-direction: column; justify-content: flex-end; /* 內容靠下 */ align-items: center; padding-bottom: 20px; /* 增加底部空間 */ box-sizing: border-box; pointer-events: none; /* Overlay 本身不攔截事件 */`,
            // 新增: targetWrapper 樣式 (取代舊的 canvasWrapper)
            targetWrapper: `position: relative; display: flex; justify-content: center; align-items: center; width: 100%; max-width: 100vw; flex-grow: 1; /* 佔據上方空間 */ margin-bottom: 150px; /* 為所有按鈕留出足夠空間 */ pointer-events: auto; /* 允許與目標元素交互 */`,
            closeButton: `position: absolute; top: 15px; right: 15px; width: 30px; height: 30px; background-color: rgba(255, 255, 255, 0.8); color: black; border: none; border-radius: 50%; font-size: 18px; font-weight: bold; line-height: 1; /* 調整 line-height */ text-align: center; cursor: pointer; z-index: 9999; user-select: none; display: flex; justify-content: center; align-items: center; box-sizing: border-box; pointer-events: auto;`,
            // --- D-Pad (絕對定位, 靠左, 稍高) ---
            dpadContainer: `display: grid; grid-template-areas: '. up .' 'left . right' '. down .'; gap: 5px; /* 减少间隙 */ width: 150px; /* 增加整体宽度 */ height: 150px; /* 增加整体高度 */ position: absolute; left: 20px; bottom: 80px; /* 向上移動 */ z-index: 9998; pointer-events: auto;`,
            dpadButton: `width: 50px; height: 50px; background-color: rgba(200, 200, 200, 0.7); border: 1px solid rgba(0, 0, 0, 0.5); border-radius: 8px; display: flex; justify-content: center; align-items: center; font-size: 24px; user-select: none; cursor: pointer; pointer-events: auto;`,
            // --- Space Button (絕對定位, 底部中間) ---
            spaceButton: `height: 50px; width: 180px; /* 固定寬度 */ max-width: 40%; /* 最大寬度 */ background-color: rgba(200, 200, 200, 0.7); border: 1px solid rgba(0, 0, 0, 0.5); border-radius: 10px; user-select: none; cursor: pointer; text-align: center; line-height: 50px; font-size: 16px; position: absolute; bottom: 20px; /* 底部 */ left: 50%; transform: translateX(-50%); z-index: 9997; pointer-events: auto;`,
            // --- Action Buttons (絕對定位, 靠右, 稍高) ---
            actionButtonContainer: `display: flex; flex-wrap: wrap; /* 允許換行 */ gap: 15px; width: 130px; /* 限制寬度以便換行 */ justify-content: center; /* 居中按鈕 */ align-items: center; position: absolute; right: 20px; bottom: 80px; /* 與 D-Pad 同高 */ z-index: 9998; pointer-events: auto;`,
            actionButton: `width: 50px; height: 50px; background-color: rgba(200, 200, 200, 0.7); border: 1px solid rgba(0, 0, 0, 0.5); border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 18px; /* 稍小字體以容納字母 */ font-weight: bold; user-select: none; cursor: pointer; pointer-events: auto;`
        };
    }

    _createDOMElement(tag, style, content = '', attributes = {}) {
        const el = document.createElement(tag);
        el.style.cssText = style;
        el.innerHTML = content;
        for (const attr in attributes) {
            el.setAttribute(attr, attributes[attr]);
        }
        return el;
    }

    _simulateKeyEvent(type, key) {
        const event = new KeyboardEvent(type, { key: key, bubbles: true });
        // console.log(`Simulating ${type}: ${key} for target element`); // 調試用

        // 檢查 targetElement 是否為 iframe
        if (this.targetElement instanceof HTMLIFrameElement) {
            // --- iframe specific logic ---
            const iframeWindow = this.targetElement.contentWindow;
            if (iframeWindow) {
                try {
                    // 嘗試從 src 屬性獲取 origin，並解析相對 URL
                    const iframeUrl = new URL(this.targetElement.src, window.location.origin);
                    const iframeOrigin = iframeUrl.origin; // origin 包含協議、主機名和端口

                    const message = {
                        type: 'keyboardEvent', // 自定義訊息類型
                        payload: {
                            eventType: event.type, // 'keydown' 或 'keyup'
                            key: event.key
                        }
                    };
                    // console.log(`Posting message to iframe (${iframeOrigin}):`, message); // 調試用
                    iframeWindow.postMessage(message, iframeOrigin);

                } catch (e) {
                    console.error('MobileGamepad: 無法 postMessage 到 iframe。請確保 iframe 的 src 屬性有效且格式正確，或指定了正確的目標源。', e);
                    // 可以考慮添加錯誤處理或回退機制
                }
            } else {
                console.warn('MobileGamepad: 無法訪問 iframe 的 contentWindow。可能 iframe 尚未加載完成或存在跨域限制。');
            }
            // --- End iframe specific logic ---

        } else {
            // --- Original logic for non-iframe targets ---
            const dispatchTarget = this.listeningElement || this.targetElement;

            // 修改: 嘗試聚焦目標元素 (targetElement 仍然是視覺焦點)
            try {
                // 檢查是否有 focus 方法且不是 disabled
                if (typeof dispatchTarget.focus === 'function' && !dispatchTarget.disabled) {
                    dispatchTarget.focus();
                }
            } catch (focusError) {
                console.warn('MobileGamepad: 嘗試聚焦目標元素時出錯:', focusError);
            }

            // 修改: 向 dispatchTarget 派發事件
            try {
                dispatchTarget.dispatchEvent(event);
                // console.log(`Event dispatched to ${dispatchTarget === document ? 'document' : dispatchTarget.tagName}`);
            } catch (e) {
                console.error(`MobileGamepad: 派發事件到 ${dispatchTarget === document ? 'document' : dispatchTarget.tagName} 時出錯: ${e}`);
            }
            // --- End original logic ---
        }
    }

    _addTouchListeners(element, key) {
        const keyRepeatRate = 50; // ms - 觸發 keydown 的頻率

        const startEvent = (e) => {
            e.preventDefault();

            // 修改: 嘗試聚焦目標元素 (視覺元素)
            try {
                // 檢查是否有 focus 方法且不是 disabled
                if (typeof element.focus === 'function' && !element.disabled) {
                    element.focus();
                }
            } catch (focusError) {
                console.warn('MobileGamepad: 嘗試聚焦目標元素時出錯:', focusError);
            }

            if (!this.touchStates[key]) {
                this.touchStates[key] = true;
                element.style.backgroundColor = 'rgba(150, 150, 150, 0.9)';
                this._simulateKeyEvent('keydown', key); // 立即觸發第一次 keydown

                // 清除可能存在的舊 interval (安全起見)
                if (this.repeatIntervals[key]) {
                    clearInterval(this.repeatIntervals[key]);
                }

                // 開始重複觸發 keydown
                this.repeatIntervals[key] = setInterval(() => {
                    this._simulateKeyEvent('keydown', key);
                }, keyRepeatRate);
            }
        };
        const endEvent = (e) => {
            if (e) e.preventDefault();
            if (this.touchStates[key]) {
                this.touchStates[key] = false;
                element.style.backgroundColor = 'rgba(200, 200, 200, 0.7)';

                // 停止重複觸發 keydown
                if (this.repeatIntervals[key]) {
                    clearInterval(this.repeatIntervals[key]);
                    delete this.repeatIntervals[key];
                }

                this._simulateKeyEvent('keyup', key); // 觸發 keyup
            }
        };

        element.addEventListener('touchstart', startEvent, { passive: false });
        element.addEventListener('touchend', endEvent, { passive: false });
        element.addEventListener('touchcancel', endEvent, { passive: false });

        element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startEvent(e);
        });
        element.addEventListener('mouseup', (e) => {
            e.preventDefault();
            endEvent(e);
        });
        element.addEventListener('mouseleave', (e) => {
            endEvent(e);
        });
    }

    // 新增: 事件監聽器註冊方法
    on(eventName, callback) {
        if (typeof callback === 'function') {
            if (!this.eventListeners[eventName]) {
                this.eventListeners[eventName] = [];
            }
            this.eventListeners[eventName].push(callback);
        } else {
            console.warn(`MobileGamepad: 為事件 '${eventName}' 提供的回呼無效。`);
        }
        return this; // 允許鏈式調用
    }

    // 新增: 觸發事件的方法
    _trigger(eventName, ...args) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(callback => {
                try {
                    callback(...args);
                } catch (e) {
                    console.error(`MobileGamepad: 執行事件 '${eventName}' 的回呼時出錯:`, e);
                }
            });
        }
    }

    bind() {
        if (this.bound) return;

        this.elements.overlay = this._createDOMElement('div', this.styles.overlay);
        document.body.appendChild(this.elements.overlay);

        // --- 通用: 禁止頁面滾動 (使用 class) ---
        this._injectScrollLockStyle(); // 確保樣式已注入
        document.documentElement.classList.add('mobile-gamepad-noscroll');
        document.body.classList.add('mobile-gamepad-noscroll');

        // --- 通用: 創建 targetWrapper 並移動 targetElement ---
        this.elements.targetWrapper = this._createDOMElement('div', this.styles.targetWrapper);
        this.elements.overlay.appendChild(this.elements.targetWrapper);

        // 儲存原始父節點和兄弟節點
        this.originalStyles.parent = this.targetElement.parentNode;
        this.originalStyles.nextSibling = this.targetElement.nextSibling;
        // 儲存原始 display 樣式 (以防萬一 flex 佈局改變它)
        this.originalStyles.display = this.targetElement.style.display;

        // 將 targetElement 移動到 wrapper 中
        this.elements.targetWrapper.appendChild(this.targetElement);

        this.elements.closeButton = this._createDOMElement('button', this.styles.closeButton, 'X');
        this.elements.closeButton.addEventListener('click', () => this.unbind());
        this.elements.overlay.appendChild(this.elements.closeButton);

        const arrowKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT'];
        const hasDPad = arrowKeys.some(key => this.keysToBind.has(key));
        if (hasDPad) {
            this.elements.dpadContainer = this._createDOMElement('div', this.styles.dpadContainer);
            const dpadButtons = {
                up: { key: 'ArrowUp', area: 'up', symbol: '▲' },
                down: { key: 'ArrowDown', area: 'down', symbol: '▼' },
                left: { key: 'ArrowLeft', area: 'left', symbol: '◀' },
                right: { key: 'ArrowRight', area: 'right', symbol: '▶' }
            };
            for (const dir in dpadButtons) {
                 const upperKey = dpadButtons[dir].key.toUpperCase();
                 if (this.keysToBind.has(upperKey)) {
                    const btnData = dpadButtons[dir];
                    const button = this._createDOMElement('button', `${this.styles.dpadButton} grid-area: ${btnData.area};`, btnData.symbol);
                    this._addTouchListeners(button, btnData.key);
                    this.elements.dpadContainer.appendChild(button);
                    this.elements[`dpad_${dir}`] = button;
                } else {
                     const placeholder = this._createDOMElement('div', `grid-area: ${dpadButtons[dir].area}; pointer-events: none;`);
                     this.elements.dpadContainer.appendChild(placeholder);
                }
            }
             this.elements.overlay.appendChild(this.elements.dpadContainer);
        }

        if (this.keysToBind.has(' ')) {
             this.elements.spaceButton = this._createDOMElement('button', this.styles.spaceButton, 'SPACE');
             this._addTouchListeners(this.elements.spaceButton, ' ');
             this.elements.overlay.appendChild(this.elements.spaceButton);
        }

        const actionKeys = [];
        const knownNonActionKeys = new Set(['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', ' ']);
        this.keysToBind.forEach(key => {
            if (key.length === 1 && key >= 'A' && key <= 'Z' && !knownNonActionKeys.has(key)) {
                actionKeys.push(key);
            }
        });

        if (actionKeys.length > 0) {
            this.elements.actionButtonContainer = this._createDOMElement('div', this.styles.actionButtonContainer);
            actionKeys.sort().forEach(key => {
                const button = this._createDOMElement('button', this.styles.actionButton, key);
                this._addTouchListeners(button, key);
                this.elements.actionButtonContainer.appendChild(button);
                this.elements[`action_${key}`] = button;
            });
            this.elements.overlay.appendChild(this.elements.actionButtonContainer);
        }

        this.bound = true;
    }

    unbind() {
        if (!this.bound) return;

        const elementsToRemove = [ 
            this.elements.closeButton,
            this.elements.dpadContainer,
            this.elements.spaceButton,
            this.elements.actionButtonContainer
        ];
        elementsToRemove.forEach(el => {
            if (el && el.parentNode === this.elements.overlay) {
                el.remove();
            }
        });

        // --- 通用: 將 targetElement 移回原始位置 ---
        if (this.originalStyles.parent) {
            this.originalStyles.parent.insertBefore(this.targetElement, this.originalStyles.nextSibling);
        } else {
            // 如果原始父節點不存在 (可能嗎？)，嘗試添加到 body
             console.warn('MobileGamepad: 無法找到原始父節點，嘗試將元素添加回 body。');
            document.body.appendChild(this.targetElement);
        }
        // 恢復原始 display 樣式
        this.targetElement.style.display = this.originalStyles.display;

        // 移除 targetWrapper (現在 targetElement 已經被移走)
        if (this.elements.targetWrapper) {
            this.elements.targetWrapper.remove();
        }

        // --- 通用: 恢復頁面滾動 (使用 class) ---
        document.documentElement.classList.remove('mobile-gamepad-noscroll');
        document.body.classList.remove('mobile-gamepad-noscroll');

        if (this.elements.overlay) {
             this.elements.overlay.remove();
        }

        this.elements = {};
        this.originalStyles = {}; // 清除儲存的樣式和節點信息

        this.touchStates = {};
        // 清除所有重複計時器
        Object.values(this.repeatIntervals).forEach(clearInterval);
        this.repeatIntervals = {};

        // 觸發 unbind 事件
        this._trigger('unbind');

        this.eventListeners = {}; // 清除事件監聽器
        this.bound = false;
    }

    // --- 輔助方法: 注入滾動鎖定樣式 ---
    _injectScrollLockStyle() {
        if (!document.getElementById(this._scrollLockStyleId)) {
            const style = document.createElement('style');
            style.id = this._scrollLockStyleId;
            style.textContent = `
                html.mobile-gamepad-noscroll,
                body.mobile-gamepad-noscroll {
                    overflow: hidden !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Export the class if using modules, or attach to window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileGamepad;
} else {
    window.MobileGamepad = MobileGamepad;
} 
