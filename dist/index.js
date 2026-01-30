let pluginName;
const blockMenuCommand = "book-plugin.insertBook";

// 加载插件
async function load(name) {
  pluginName = name;
  console.log(`${pluginName} loaded.`);
  
  // 注册块菜单命令
  orca.blockMenuCommands.registerBlockMenuCommand(blockMenuCommand, {
    worksOnMultipleBlocks: false,
    render: (blockId, selectedBlocks, closeMenu) => {
      const React = window.React || orca.React;
      return React.createElement(orca.components.MenuText, {
        preIcon: "ti ti-book",
        title: "生成书籍",
        onClick: () => {
          closeMenu();
          
          // 创建搜索框界面
          createSearchBox(blockId);
        }
      });
    }
  });
  console.log(`[${pluginName}] Block menu command registered: ${blockMenuCommand}`);
}

// 创建搜索框界面
function createSearchBox(blockId) {
  // 检查是否已存在搜索框
  if (document.getElementById('book-search-box')) {
    document.getElementById('book-search-box').remove();
  }
  
  // 创建搜索框容器
  const searchBox = document.createElement('div');
  searchBox.id = 'book-search-box';
  searchBox.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 300px;
    max-width: 500px;
    width: 90%;
  `;
  
  // 创建标题
  const title = document.createElement('h3');
  title.textContent = '搜索书籍';
  title.style.cssText = `
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  `;
  searchBox.appendChild(title);
  
  // 创建搜索表单
  const form = document.createElement('form');
  form.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  
  // 创建输入框
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '输入书籍名称...';
  input.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  form.appendChild(input);
  
  // 创建搜索按钮
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = '搜索';
  button.style.cssText = `
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  form.appendChild(button);
  
  // 创建取消按钮
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = '取消';
  cancelButton.style.cssText = `
    margin-top: 12px;
    padding: 8px 16px;
    background: #f3f4f6;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  
  // 表单提交事件
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const searchText = input.value.trim();
    if (searchText) {
      // 关闭搜索框
      if (document.getElementById('book-search-box')) {
        document.getElementById('book-search-box').remove();
      }
      
      // 禁用按钮，显示加载状态
      button.disabled = true;
      button.textContent = '搜索中...';
      
      try {
        // 执行豆瓣搜索
        await searchDouban(searchText);
      } catch (error) {
        console.error('搜索失败:', error);
        alert(`搜索失败: ${error.message}`);
      } finally {
        // 恢复按钮状态
        button.disabled = false;
        button.textContent = '搜索';
      }
    }
  });
  
  // 取消按钮点击事件
  cancelButton.addEventListener('click', () => {
    searchBox.remove();
  });
  
  // 添加元素到搜索框
  searchBox.appendChild(form);
  searchBox.appendChild(cancelButton);
  
  // 添加到文档
  document.body.appendChild(searchBox);
  
  // 自动聚焦输入框
  input.focus();
}

// 搜索豆瓣书籍
async function searchDouban(keyword) {
  try {
    // 使用备用方案创建搜索窗口
    const result = await createBrowserWindowSearch(keyword);
    
    if (result.success) {
      // 解析书籍信息
      const bookInfo = parseBookInfo(result.html);
      
      // 显示书籍信息
      showBookInfo(bookInfo);
    } else {
      throw new Error(result.error || '搜索失败');
    }
  } catch (error) {
    console.error('豆瓣搜索失败:', error);
    throw error;
  }
}

// 使用备用方案创建搜索窗口
async function createBrowserWindowSearch(keyword) {
  return new Promise(async (resolve, reject) => {
    try {
      // 检查是否在Electron环境中
      if (window.navigator.userAgent.includes('Electron') && typeof window.require === 'function') {
        // 使用Electron的BrowserWindow（参考插件的方法）
        const result = await createElectronSearchWindow(keyword);
        resolve(result);
      } else {
        // 使用备用方案（非 Electron 环境）
        await useFallbackSearch(keyword, resolve, reject);
      }
    } catch (error) {
      console.error('创建搜索窗口失败:', error);
      // 回退到备用方案
      await useFallbackSearch(keyword, resolve, reject);
    }
  });
}

// 使用Electron的BrowserWindow创建搜索窗口（参考插件的方法）
async function createElectronSearchWindow(keyword) {
  return new Promise(async (resolve, reject) => {
    let browserWindow = null;
    let captureComplete = false;
    
    try {
      // 导入Electron的remote模块
      const remote = window.require('@electron/remote');
      if (!remote) {
        throw new Error('Remote module not available');
      }
      
      // 创建BrowserWindow
      browserWindow = new remote.BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        frame: false,
        titleBarStyle: 'hidden',
        autoHideMenuBar: true,
        title: `豆瓣搜索: ${keyword}`,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: false,
          allowRunningInsecureContent: true,
          experimentalFeatures: true
        }
      });
      
      // 监听页面导航事件，注入控制栏
      browserWindow.webContents.on('did-navigate', (event, url) => {
        setTimeout(() => {
          browserWindow.webContents.executeJavaScript(`
            (function() {
              // 如果已存在控制栏，先移除
              const existingBar = document.getElementById('douban-persistent-control-bar');
              if (existingBar) {
                existingBar.remove();
              }
              
              // 创建控制栏容器
              const controlBar = document.createElement('div');
              controlBar.id = 'douban-persistent-control-bar';
              controlBar.innerHTML = \`
                <div style="position: fixed; top: 0; left: 0; right: 0; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; z-index: 999999; box-shadow: 0 2px 10px rgba(0,0,0,0.2); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <div style="font-size: 16px; font-weight: 500;">📚 豆瓣图书搜索</div>
                  <div>
                    <button id="get-book-info-persistent" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px; font-size: 14px; transition: background 0.3s;" onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">📖 获取此书信息</button>
                    <button id="close-window-persistent" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; transition: background 0.3s;" onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">❌ 关闭窗口</button>
                  </div>
                </div>
              \`;
              
              // 添加控制栏到页面
              document.documentElement.appendChild(controlBar);
              
              // 为页面内容添加顶部边距，避免被控制栏遮挡
              if (!document.body.style.paddingTop || document.body.style.paddingTop === '0px') {
                document.body.style.paddingTop = '50px';
              }
              
              // 定义按钮点击处理函数
              window._doubanGetBookInfo = function() {
                const btn = document.getElementById('get-book-info-persistent');
                if (btn) {
                  btn.innerHTML = '⏳ 获取中...';
                  btn.disabled = true;
                }
                
                // 获取当前页面的HTML
                const htmlContent = document.documentElement.outerHTML;
                
                // 显示处理中提示
                const processingTip = document.createElement('div');
                processingTip.innerHTML = '<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 123, 255, 0.9); color: white; padding: 20px; border-radius: 8px; z-index: 1000000; font-size: 16px; text-align: center;">📚 正在处理书籍信息...<br><small>请稍候</small></div>';
                document.body.appendChild(processingTip);
                
                // 使用console.log发送数据给Electron
                console.log('[CAPTURE]' + htmlContent);
                
                // 1秒后关闭窗口
                setTimeout(() => {
                  window.close();
                }, 1000);
              };
              
              window._doubanCloseWindow = function() {
                window.close();
              };
              
              // 绑定按钮事件
              document.getElementById('get-book-info-persistent').addEventListener('click', window._doubanGetBookInfo);
              document.getElementById('close-window-persistent').addEventListener('click', window._doubanCloseWindow);
            })();
          `);
        }, 1500);
        
        // 更新窗口标题
        if (url.includes('/book/')) {
          browserWindow.setTitle('📖 书籍详情 - 点击顶部按钮获取信息');
        } else {
          browserWindow.setTitle('🔍 豆瓣图书搜索 - 点击顶部按钮获取信息');
        }
      });
      
      // 构建搜索URL
      const searchUrl = `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(keyword)}&cat=1001`;
      
      // 加载搜索页面
      await browserWindow.loadURL(searchUrl, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        httpReferrer: 'https://www.douban.com/'
      });
      
      // 显示初始操作提示
      try {
        browserWindow.webContents.executeJavaScript(`
          // 显示初始操作提示（位置调整到顶栏下方）
          const tip = document.createElement('div');
          tip.innerHTML = '<div style="position: fixed; top: 60px; right: 20px; background: #4CAF50; color: white; padding: 12px 15px; border-radius: 5px; z-index: 999999; font-size: 14px; font-family: Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.2); max-width: 300px; line-height: 1.4;">📖 操作提示：点击您要搜索的书籍，进入详情页后点击顶部按钮获取信息。</div>';
          document.body.appendChild(tip);
          
          // 5秒后移除提示
          setTimeout(() => {
            if (tip.parentNode) {
              tip.parentNode.removeChild(tip);
            }
          }, 5000);
        `);
      } catch (error) {
        console.error('显示提示失败:', error);
      }
      
      // 显示窗口
      browserWindow.show();
      
      // 监听窗口关闭事件
      browserWindow.on('close', (event) => {
        try {
          if (browserWindow.webContents.executeJavaScriptSync('window.__captureComplete')) {
            return;
          }
        } catch (error) {
          console.error('检查捕获状态失败:', error);
        }
        
        if (!captureComplete) {
          captureComplete = true;
          resolve({ success: false, error: 'Window closed without selecting book' });
        }
      });
      
      // 监听控制台消息，捕获HTML内容
      browserWindow.webContents.on('console-message', (event, level, message) => {
        if (message.includes('[CAPTURE]') && !captureComplete) {
          const html = message.replace('[CAPTURE]', '');
          if (html && html.length > 0) {
            captureComplete = true;
            resolve({ success: true, html });
            
            // 延迟销毁窗口
            setTimeout(() => {
              try {
                browserWindow.destroy();
              } catch (error) {
                console.error('销毁窗口失败:', error);
              }
            }, 1000);
          }
        }
      });
      
      // 监听窗口关闭事件
      browserWindow.on('closed', () => {
        if (!captureComplete) {
          captureComplete = true;
          resolve({ success: false, error: 'Window closed without capturing HTML' });
        }
      });
    } catch (error) {
      console.error('[BrowserWindow] Error in search window:', error);
      
      // 清理窗口
      if (browserWindow) {
        try {
          browserWindow.destroy();
        } catch (destroyError) {
          console.error('[BrowserWindow] Error destroying window:', destroyError);
        }
      }
      
      reject({ success: false, error: error.message });
    }
  });
}

// 备用搜索方案（非 Electron 环境）
function useFallbackSearch(keyword, resolve, reject) {
  try {
    // 构建豆瓣搜索URL
    const searchUrl = `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(keyword)}&cat=1001`;
    
    // 创建备用搜索窗口
    createFallbackSearchWindow(searchUrl, resolve, reject);
  } catch (error) {
    console.error('[Fallback] Error in fallback search:', error);
    reject(new Error('搜索失败: ' + error.message));
  }
}

// 创建备用搜索窗口
function createFallbackSearchWindow(url, resolve, reject) {
  // 检查是否已存在搜索窗口
  if (document.getElementById('book-search-window')) {
    document.getElementById('book-search-window').remove();
  }
  
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.id = 'book-search-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // 创建搜索窗口
  const searchWindow = document.createElement('div');
  searchWindow.id = 'book-search-window';
  searchWindow.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 90%;
    max-width: 1200px;
    height: 80vh;
    max-height: 800px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;
  
  // 创建窗口标题栏
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  `;
  
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 16px;
    font-weight: 500;
  `;
  title.textContent = '📚 豆瓣图书搜索';
  
  const titleButtons = document.createElement('div');
  titleButtons.style.cssText = `
    display: flex;
    gap: 8px;
  `;
  
  const extractButton = document.createElement('button');
  extractButton.textContent = '📖 提取书籍信息';
  extractButton.style.cssText = `
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  
  const refreshButton = document.createElement('button');
  refreshButton.textContent = '🔄 刷新';
  refreshButton.style.cssText = `
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '❌ 关闭';
  closeButton.style.cssText = `
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  
  // 创建内容区域
  const contentArea = document.createElement('div');
  contentArea.style.cssText = `
    flex: 1;
    overflow: hidden;
    position: relative;
  `;
  
  // 创建iframe
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;
  
  // 创建操作提示
  const tip = document.createElement('div');
  tip.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 123, 255, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10;
    max-width: 300px;
  `;
  tip.textContent = '📖 请在页面中找到您想要的书籍，进入详情页后点击上方的提取书籍信息按钮。';
  
  // 刷新按钮点击事件
  refreshButton.addEventListener('click', () => {
    iframe.src = iframe.src;
  });
  
  // 提取按钮点击事件
      extractButton.addEventListener('click', async () => {
        try {
          // 检查是否在豆瓣书籍详情页
      let currentUrl = iframe.src;
      console.log('当前iframe.src:', currentUrl);
      
      // 尝试获取iframe内部的实际URL（可能被跨域限制）
      try {
        if (iframe.contentWindow && iframe.contentWindow.location) {
          currentUrl = iframe.contentWindow.location.href;
          console.log('获取到的iframe内部URL:', currentUrl);
        }
      } catch (e) {
        console.log('无法获取iframe内部URL（跨域限制）:', e.message);
        // 跨域限制是正常的，我们将继续使用iframe.src
      }
      
      // 验证豆瓣书籍详情页URL格式
      const bookDetailUrlPattern = /https?:\/\/book\.douban\.com\/subject\/\d+\/?/;
      
      // 即使URL验证失败，我们也应该尝试提取内容
      // 因为用户可能已经在详情页，只是iframe.src没有更新
      if (!bookDetailUrlPattern.test(currentUrl)) {
        console.log('URL格式验证失败，但仍尝试提取内容');
        // 不阻止提取，而是继续尝试
      }
      
      // 标准化URL格式（如果是详情页URL）
      let normalizedUrl = currentUrl;
      if (bookDetailUrlPattern.test(currentUrl)) {
        normalizedUrl = currentUrl.replace(/\/$/, '') + '/';
        console.log('标准化后的URL:', normalizedUrl);
      }
      
      console.log('最终使用的URL:', normalizedUrl);
          
          // 禁用按钮，显示加载状态
          extractButton.disabled = true;
          extractButton.textContent = '📖 提取中...';
          
          // 显示处理中提示
          const processingTip = document.createElement('div');
          processingTip.id = 'processing-tip';
          processingTip.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 123, 255, 0.9);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 20;
            font-size: 14px;
            text-align: center;
            min-width: 200px;
          `;
          processingTip.innerHTML = '📚 正在提取书籍信息，请稍候...<br><small>这可能需要几秒钟时间</small>';
          contentArea.appendChild(processingTip);
      
      // 保存HTML内容到桌面的函数
      function saveHtmlToDesktop(html, method) {
        try {
          const filename = `douban_book_${method}_${new Date().getTime()}.html`;
          
          // 创建Blob对象
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          
          // 创建下载链接
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          
          // 触发下载
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // 释放URL对象
          URL.revokeObjectURL(link.href);
          
          console.log(`HTML内容已保存到桌面: ${filename}`);
        } catch (error) {
          console.error('保存HTML到桌面失败:', error);
        }
      }
      
      // 等待页面完全加载（改进版）
      await new Promise(resolveLoad => {
        let checkInterval;
        let checkCount = 0;
        const maxChecks = 30; // 最多检查30次（约30秒）
        
        // 检查页面是否加载完成并包含关键元素
        const checkPageLoaded = () => {
          checkCount++;
          
          try {
            // 检查iframe是否加载完成
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
              // 检查是否包含豆瓣详情页的关键元素
              const hasBookInfo = iframe.contentDocument.querySelector('#info') || 
                               iframe.contentDocument.querySelector('h1') || 
                               iframe.contentDocument.querySelector('.rating_num');
              
              if (hasBookInfo) {
                console.log('页面加载完成，找到关键元素');
                clearInterval(checkInterval);
                resolveLoad();
              } else if (checkCount >= maxChecks) {
                console.log('页面加载超时，强制继续');
                clearInterval(checkInterval);
                resolveLoad();
              } else {
                console.log(`页面加载中，检查次数: ${checkCount}/${maxChecks}`);
              }
            } else if (checkCount >= maxChecks) {
              console.log('页面加载超时，强制继续');
              clearInterval(checkInterval);
              resolveLoad();
            }
          } catch (error) {
            console.log('检查页面状态时发生错误（可能是跨域限制）:', error);
            // 跨域限制，无法访问iframe内容，直接继续
            clearInterval(checkInterval);
            resolveLoad();
          }
        };
        
        // 开始定期检查
        checkInterval = setInterval(checkPageLoaded, 1000);
        
        // 立即检查一次
        checkPageLoaded();
      });
      
      console.log('开始获取豆瓣详情页内容:', currentUrl);
      
      // 尝试直接从iframe中读取HTML内容（可能被跨域限制）
      let iframeHtml = null;
      try {
        console.log('尝试直接从iframe中读取HTML内容');
        if (iframe.contentDocument) {
          const doc = iframe.contentDocument;
          console.log('成功访问iframe.contentDocument');
          console.log('iframe文档URL:', doc.URL);
          console.log('iframe文档readyState:', doc.readyState);
          
          // 尝试获取完整的HTML内容
          iframeHtml = doc.documentElement.outerHTML;
          console.log('从iframe中获取的HTML内容长度:', iframeHtml.length);
          
          // 保存HTML到桌面用于调试
          if (iframeHtml && iframeHtml.length > 0) {
            saveHtmlToDesktop(iframeHtml, 'iframe_direct');
            console.log('已保存iframe直接读取的HTML内容到桌面');
          }
        }
      } catch (e) {
        console.log('无法直接从iframe中读取HTML内容（跨域限制）:', e.message);
        // 跨域限制是正常的，我们将继续使用其他方法
      }
      
      // 如果成功从iframe中获取了HTML内容，直接使用它
      if (iframeHtml && iframeHtml.length > 0) {
        console.log('使用从iframe直接读取的HTML内容');
        
        // 解析书籍信息
        const bookInfo = parseBookInfo(iframeHtml);
        
        // 显示书籍信息
        showBookInfoWithReferenceUI(bookInfo);
        
        // 关闭iframe窗口
        overlay.remove();
        resolve({ success: true, html: iframeHtml });
        return;
      }
      
      // 带重试机制的fetch函数
      async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(url, options);
            if (response.ok) {
              return response;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          } catch (error) {
            console.log(`尝试 ${i + 1}/${retries} 失败:`, error.message);
            if (i === retries - 1) {
              throw error;
            }
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // 尝试使用CORS代理获取豆瓣详情页内容（最可靠的方法）
      try {
        // 确定要使用的URL
        let urlToUse = normalizedUrl;
        
        // 检查URL是否包含搜索页面的特征
        if (urlToUse.includes('search.douban.com') && urlToUse.includes('subject_search')) {
          console.log('检测到搜索页面URL，尝试从iframe内容中提取详情页URL');
          
          // 尝试从iframe内容中提取详情页URL（可能被跨域限制）
          try {
            if (iframe.contentDocument) {
              // 查找页面中的详情页链接
              const detailLinks = iframe.contentDocument.querySelectorAll('a[href*="/subject/"]');
              for (const link of detailLinks) {
                const href = link.getAttribute('href');
                if (href && href.includes('book.douban.com/subject/')) {
                  urlToUse = href;
                  if (!urlToUse.startsWith('http')) {
                    urlToUse = 'https:' + urlToUse;
                  }
                  console.log('从页面中提取到详情页URL:', urlToUse);
                  break;
                }
              }
            }
          } catch (e) {
            console.log('无法从iframe内容中提取URL（跨域限制）:', e.message);
          }
        }
        
        // 标准化最终使用的URL
        if (urlToUse && urlToUse.includes('book.douban.com/subject/')) {
          urlToUse = urlToUse.replace(/\/$/, '') + '/';
        }
        
        console.log('最终确定的URL:', urlToUse);
        
        // 使用CORS代理获取内容
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlToUse)}`;
        
        console.log('使用CORS代理获取内容:', proxyUrl);
        
        const response = await fetchWithRetry(proxyUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          console.log('通过CORS代理获取的HTML内容长度:', html.length);
          
          // 保存HTML到桌面
          saveHtmlToDesktop(html, 'proxy');
          
          // 解析书籍信息
          const bookInfo = parseBookInfo(html);
          
          // 显示书籍信息
          showBookInfoWithReferenceUI(bookInfo);
          
          // 关闭iframe窗口
          overlay.remove();
          resolve({ success: true, html });
        } else {
          throw new Error(`无法通过代理获取页面内容，状态码: ${response.status}`);
        }
      } catch (proxyError) {
        console.error('通过CORS代理获取页面失败:', proxyError);
        
        // 尝试使用虎鲸笔记的API
        try {
          if (typeof orca !== 'undefined' && orca.fetchSyncPost) {
            console.log('尝试使用orca.fetchSyncPost获取内容');
            const response = await orca.fetchSyncPost(urlToUse, {});
            
            if (response) {
              console.log('通过orca.fetchSyncPost获取的HTML内容长度:', response.length);
              // 保存HTML到桌面
              saveHtmlToDesktop(response, 'orca');
              // 解析书籍信息
              const bookInfo = parseBookInfo(response);
              
              // 显示书籍信息
              showBookInfoWithReferenceUI(bookInfo);
              
              // 关闭iframe窗口
              overlay.remove();
              resolve({ success: true, html: response });
            } else {
              throw new Error('无法获取页面内容');
            }
          } else {
            throw new Error('orca.fetchSyncPost不可用');
          }
        } catch (orcaError) {
          console.error('通过orca.fetchSyncPost获取页面失败:', orcaError);
          
          // 尝试直接使用fetch API
          try {
            console.log('尝试使用fetch API获取内容');
            const response = await fetchWithRetry(urlToUse, {
              headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });
            
            if (response.ok) {
              const html = await response.text();
              console.log('通过fetch API获取的HTML内容长度:', html.length);
              // 保存HTML到桌面
              saveHtmlToDesktop(html, 'fetch');
              
              // 解析书籍信息
              const bookInfo = parseBookInfo(html);
              
              // 显示书籍信息
              showBookInfoWithReferenceUI(bookInfo);
              
              // 关闭iframe窗口
              overlay.remove();
              resolve({ success: true, html });
            } else {
              throw new Error(`无法获取页面内容，状态码: ${response.status}`);
            }
          } catch (fetchError) {
            console.error('通过fetch API获取页面失败:', fetchError);
            
            // 提示用户手动复制URL
            const url = await createCustomPrompt('请复制并粘贴豆瓣书籍详情页的URL（例如：https://book.douban.com/subject/35503571/）:', currentUrl);
            
            if (url && url.includes('book.douban.com/subject/')) {
              // 再次尝试使用CORS代理
              try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                const response = await fetchWithRetry(proxyUrl);
                
                if (response.ok) {
                  const html = await response.text();
                  console.log('通过CORS代理获取的手动输入URL的HTML内容长度:', html.length);
                  // 保存HTML到桌面
                  saveHtmlToDesktop(html, 'proxy_manual');
                  
                  // 解析书籍信息
                  const bookInfo = parseBookInfo(html);
                  
                  // 显示书籍信息
                  showBookInfoWithReferenceUI(bookInfo);
                  
                  // 关闭iframe窗口
                  overlay.remove();
                  resolve({ success: true, html });
                } else {
                  throw new Error('无法通过代理获取页面内容');
                }
              } catch (finalError) {
                console.error('最终尝试失败:', finalError);
                alert('❌ 由于网络限制，无法自动获取书籍信息。\n\n请尝试以下解决方案:\n1. 检查网络连接\n2. 稍后再试\n3. 手动输入书籍信息');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('提取书籍信息失败:', error);
      
      // 根据错误类型提供不同的错误信息
      let errorMessage = '❌ 提取书籍信息失败';
      if (error.message.includes('NetworkError')) {
        errorMessage += ': 网络连接失败，请检查网络设置';
      } else if (error.message.includes('404')) {
        errorMessage += ': 页面未找到，请确认书籍链接是否正确';
      } else if (error.message.includes('50')) {
        errorMessage += ': 服务器错误，请稍后再试';
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      alert(errorMessage);
      reject(new Error('提取书籍信息失败: ' + error.message));
    } finally {
      // 恢复按钮状态
      extractButton.disabled = false;
      extractButton.textContent = '📖 提取书籍信息';
      
      // 移除处理中提示
      const processingTip = document.getElementById('processing-tip');
      if (processingTip) {
        processingTip.remove();
      }
    }
  });
  
  // 关闭按钮点击事件
  closeButton.addEventListener('click', () => {
    overlay.remove();
    reject(new Error('窗口已关闭'));
  });
  
  // 添加元素到标题栏
  titleButtons.appendChild(extractButton);
  titleButtons.appendChild(refreshButton);
  titleButtons.appendChild(closeButton);
  titleBar.appendChild(title);
  titleBar.appendChild(titleButtons);
  
  // 添加元素到内容区域
  contentArea.appendChild(iframe);
  contentArea.appendChild(tip);
  
  // 添加元素到搜索窗口
  searchWindow.appendChild(titleBar);
  searchWindow.appendChild(contentArea);
  
  // 添加到遮罩层
  overlay.appendChild(searchWindow);
  
  // 添加到文档
  document.body.appendChild(overlay);
  
  // 监听iframe加载完成，注入控制栏
  iframe.onload = () => {
    try {
      // 尝试注入控制栏到iframe
      injectControlBarToIframe(iframe);
    } catch (error) {
      console.error('注入控制栏失败', error);
      // 跨域限制，无法注入脚本，使用外部提取按钮
    }
  };
}

// 注入控制栏到iframe
function injectControlBarToIframe(iframe) {
  try {
    // 尝试访问iframe的document对象
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    // 如果成功访问，说明没有跨域限制
    // 但由于豆瓣网站的安全设置，我们可能仍然无法注入脚本
    console.log('成功访问iframe内容');
    
    // 这里我们不再尝试注入控制栏，因为豆瓣网站可能会阻止这种操作
    // 而是依赖外部的提取按钮
  } catch (error) {
    console.error('注入控制栏到iframe失败:', error);
    // 跨域限制，无法直接注入脚本
    // 这是正常的安全限制，我们会使用外部的提取按钮
  }
}

// 创建自定义输入框，替代浏览器的 prompt() 函数
function createCustomPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 400px;
      max-width: 600px;
      width: 90%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // 创建消息
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      margin-bottom: 16px;
      font-size: 14px;
      color: #333;
      line-height: 1.4;
    `;
    messageElement.textContent = message;
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 16px;
      box-sizing: border-box;
    `;
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    `;
    
    // 创建取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = `
      padding: 8px 16px;
      background: #f3f4f6;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    
    // 创建确定按钮
    const confirmButton = document.createElement('button');
    confirmButton.textContent = '确定';
    confirmButton.style.cssText = `
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    
    // 取消按钮点击事件
    cancelButton.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });
    
    // 确定按钮点击事件
    confirmButton.addEventListener('click', () => {
      const value = input.value.trim();
      overlay.remove();
      resolve(value);
    });
    
    // 回车键事件
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const value = input.value.trim();
        overlay.remove();
        resolve(value);
      }
    });
    
    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });
    
    // 添加元素
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    dialog.appendChild(messageElement);
    dialog.appendChild(input);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 自动聚焦输入框
    input.focus();
    input.select();
  });
}

// 使用参考插件风格显示书籍信息
function showBookInfoWithReferenceUI(bookInfo) {
  // 检查是否已存在信息窗口
  if (document.getElementById('book-info-window')) {
    document.getElementById('book-info-window').remove();
  }
  
  // 创建信息窗口
  const infoWindow = document.createElement('div');
  infoWindow.id = 'book-info-window';
  infoWindow.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    min-width: 400px;
    max-width: 700px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // 创建标题
  const title = document.createElement('h3');
  title.textContent = '📚 书籍信息';
  title.style.cssText = `
    margin-top: 0;
    margin-bottom: 24px;
    color: #333;
    font-size: 20px;
    font-weight: 600;
    text-align: center;
  `;
  infoWindow.appendChild(title);
  
  // 创建书籍信息内容
  const content = document.createElement('div');
  content.style.cssText = `
    display: flex;
    gap: 24px;
    margin-bottom: 24px;
  `;
  
  // 封面
  if (bookInfo.cover) {
    const coverElement = document.createElement('div');
    coverElement.style.cssText = `
      flex-shrink: 0;
      width: 150px;
    `;
    
    const img = document.createElement('img');
    img.src = bookInfo.cover;
    img.style.cssText = `
      width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      object-fit: cover;
    `;
    
    coverElement.appendChild(img);
    content.appendChild(coverElement);
  }
  
  // 信息
  const infoContent = document.createElement('div');
  infoContent.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  `;
  
  // 书名
  const bookTitle = document.createElement('div');
  bookTitle.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: #333;
    line-height: 1.3;
  `;
  bookTitle.textContent = bookInfo.title;
  infoContent.appendChild(bookTitle);
  
  // 作者
  if (bookInfo.authors.length > 0) {
    const bookAuthors = document.createElement('div');
    bookAuthors.style.cssText = `
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    `;
    bookAuthors.innerHTML = `<strong style="color: #333;">作者:</strong> ${bookInfo.authors.join(', ')}`;
    infoContent.appendChild(bookAuthors);
  }
  
  // 出版社信息
  if (bookInfo.publisher) {
    const publisherInfo = document.createElement('div');
    publisherInfo.style.cssText = `
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    `;
    publisherInfo.innerHTML = `<strong style="color: #333;">出版社:</strong> ${bookInfo.publisher}${bookInfo.publishDate ? ` (${bookInfo.publishDate})` : ''}`;
    infoContent.appendChild(publisherInfo);
  }
  
  // ISBN
  if (bookInfo.isbn) {
    const bookIsbn = document.createElement('div');
    bookIsbn.style.cssText = `
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    `;
    bookIsbn.innerHTML = `<strong style="color: #333;">ISBN:</strong> ${bookInfo.isbn}`;
    infoContent.appendChild(bookIsbn);
  }
  
  // 评分
  if (bookInfo.rating) {
    const bookRating = document.createElement('div');
    bookRating.style.cssText = `
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    `;
    bookRating.innerHTML = `<strong style="color: #333;">评分:</strong> <span style="color: #f5a623; font-weight: 500;">${bookInfo.rating}</span> (${bookInfo.ratingCount || 0}人评价)`;
    infoContent.appendChild(bookRating);
  }
  
  content.appendChild(infoContent);
  infoWindow.appendChild(content);
  
  // 简介
  if (bookInfo.description) {
    const bookDescription = document.createElement('div');
    bookDescription.style.cssText = `
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #eaeaea;
    `;
    
    const descriptionTitle = document.createElement('h4');
    descriptionTitle.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #333;
    `;
    descriptionTitle.textContent = '📖 内容简介';
    bookDescription.appendChild(descriptionTitle);
    
    const descriptionText = document.createElement('div');
    descriptionText.style.cssText = `
      font-size: 14px;
      line-height: 1.6;
      color: #555;
      white-space: pre-wrap;
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
    `;
    descriptionText.textContent = bookInfo.description;
    bookDescription.appendChild(descriptionText);
    
    infoWindow.appendChild(bookDescription);
  }
  
  // 操作按钮
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    margin-top: 24px;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  `;
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
    padding: 10px 20px;
    background: #f3f4f6;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
  `;
  
  closeButton.addEventListener('mouseover', () => {
    closeButton.style.background = '#e5e7eb';
  });
  
  closeButton.addEventListener('mouseout', () => {
    closeButton.style.background = '#f3f4f6';
  });
  
  closeButton.addEventListener('click', () => {
    infoWindow.remove();
  });
  
  buttonContainer.appendChild(closeButton);
  infoWindow.appendChild(buttonContainer);
  
  // 添加到文档
  document.body.appendChild(infoWindow);
}

// 解析书籍信息
function parseBookInfo(html) {
  try {
    console.log('开始解析书籍信息，HTML长度:', html.length);
    
    // 检查HTML是否为空
    if (!html || html.length === 0) {
      console.error('HTML内容为空');
      return {
        title: '未知书名',
        authors: [],
        publisher: '',
        publishDate: '',
        isbn: '',
        rating: '暂无评分',
        ratingCount: '',
        cover: '',
        description: ''
      };
    }
    
    // 检查HTML是否包含豆瓣详情页特征
    if (!html.includes('book.douban.com') || !html.includes('subject/')) {
      console.error('HTML内容不是豆瓣书籍详情页');
      return {
        title: '未知书名',
        authors: [],
        publisher: '',
        publishDate: '',
        isbn: '',
        rating: '暂无评分',
        ratingCount: '',
        cover: '',
        description: ''
      };
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 提取书名 - 针对豆瓣详情页优化
    let titleElement = doc.querySelector('h1');
    if (!titleElement) {
      titleElement = doc.querySelector('title');
    }
    let title = titleElement ? titleElement.textContent.trim() : '未知书名';
    // 清理书名（如果从title标签提取，可能包含额外信息）
    if (title.includes('\n')) {
      title = title.split('\n')[0].trim();
    }
    if (title.includes(' - 豆瓣')) {
      title = title.replace(' - 豆瓣', '').trim();
    }
    console.log('提取的书名:', title);
    
    // 提取作者 - 针对豆瓣详情页优化
    let authors = [];
    try {
      // 方法1: 传统方法（针对豆瓣详情页结构）
      const infoElement = doc.querySelector('#info');
      if (infoElement) {
        // 方法1a: 从info元素中提取作者信息（最可靠）
        const infoText = infoElement.textContent;
        
        // 提取作者
        const authorMatch = infoText.match(/作者[:：]\s*([^\n]+)/);
        if (authorMatch) {
          let authorText = authorMatch[1].trim();
          // 清理作者信息
          authorText = authorText.replace(/\s+/g, ' ').trim();
          // 分割多个作者
          authors = authorText.split('/').map(author => author.trim()).filter(Boolean);
        }
        
        // 方法1b: 如果方法1a失败，尝试从链接中提取
        if (authors.length === 0) {
          const authorLinks = infoElement.querySelectorAll('a');
          authorLinks.forEach(link => {
            const parentText = link.parentElement.textContent;
            if (parentText.includes('作者') || parentText.includes('译者')) {
              authors.push(link.textContent.trim());
            }
          });
        }
      }
      
      // 方法2: 如果方法1失败，尝试传统方法
      if (authors.length === 0) {
        const authorElements = doc.querySelectorAll('span.pl');
        authorElements.forEach(element => {
          if (element.textContent.trim() === '作者') {
            const authorLinks = element.parentElement.querySelectorAll('a');
            authors = Array.from(authorLinks).map(link => link.textContent.trim());
          }
        });
      }
    } catch (e) {
      console.error('提取作者失败:', e);
    }
    console.log('提取的作者:', authors);
    
    // 提取出版社信息 - 针对豆瓣详情页优化
    const infoElement = doc.querySelector('#info');
    let publisher = '', publishDate = '', isbn = '';
    
    if (infoElement) {
      try {
        const infoText = infoElement.textContent;
        
        // 提取出版社
        const publisherMatch = infoText.match(/出版社[:：]\s*([^\n]+)/);
        if (publisherMatch) {
          publisher = publisherMatch[1].trim();
        }
        console.log('提取的出版社:', publisher);
        
        // 提取出版年
        const publishDateMatch = infoText.match(/出版年[:：]\s*([^\n]+)/);
        if (publishDateMatch) {
          publishDate = publishDateMatch[1].trim();
        }
        console.log('提取的出版年:', publishDate);
        
        // 提取ISBN
        const isbnMatch = infoText.match(/ISBN[:：]\s*([^\n]+)/);
        if (isbnMatch) {
          isbn = isbnMatch[1].trim();
        }
        console.log('提取的ISBN:', isbn);
      } catch (e) {
        console.error('提取出版社信息失败:', e);
      }
    } else {
      console.error('未找到#info元素');
    }
    
    // 提取评分 - 针对豆瓣详情页优化
    let ratingElement = doc.querySelector('.rating_num');
    if (!ratingElement) {
      ratingElement = doc.querySelector('[property="v:average"]');
    }
    const rating = ratingElement ? ratingElement.textContent.trim() : '暂无评分';
    console.log('提取的评分:', rating);
    
    // 提取评分人数 - 针对豆瓣详情页优化
    let ratingCountElement = doc.querySelector('.rating_people span');
    if (!ratingCountElement) {
      ratingCountElement = doc.querySelector('[property="v:votes"]');
    }
    let ratingCount = '';
    if (ratingCountElement) {
      const countMatch = ratingCountElement.textContent.match(/\d+/);
      if (countMatch) {
        ratingCount = countMatch[0];
      }
    }
    console.log('提取的评分人数:', ratingCount);
    
    // 提取封面 - 针对豆瓣详情页优化
    let coverElement = doc.querySelector('#mainpic img');
    if (!coverElement) {
      coverElement = doc.querySelector('[property="og:image"]');
    }
    let cover = '';
    if (coverElement) {
      if (coverElement.tagName === 'META') {
        cover = coverElement.getAttribute('content');
      } else {
        cover = coverElement.getAttribute('src');
      }
    }
    // 确保封面URL完整
    if (cover && cover.startsWith('//')) {
      cover = 'https:' + cover;
    }
    console.log('提取的封面:', cover);
    
    // 提取简介 - 针对豆瓣详情页优化
    let description = '';
    try {
      // 方法1: 完整简介（展开后）
      let descriptionElement = doc.querySelector('#link-report .all .intro');
      if (!descriptionElement) {
        // 方法2: 简短简介
        descriptionElement = doc.querySelector('#link-report .short .intro');
      }
      if (!descriptionElement) {
        // 方法3: 直接从#link-report提取
        descriptionElement = doc.querySelector('#link-report');
      }
      if (!descriptionElement) {
        // 方法4: meta标签
        descriptionElement = doc.querySelector('[property="og:description"]');
      }
      
      if (descriptionElement) {
        if (descriptionElement.tagName === 'META') {
          description = descriptionElement.getAttribute('content') || '';
        } else {
          const paragraphs = descriptionElement.querySelectorAll('p');
          if (paragraphs.length > 0) {
            description = Array.from(paragraphs)
              .map(p => p.textContent.trim())
              .filter(text => text && !text.includes('(展开全部)') && !text.includes('(收起)'))
              .join('\n\n');
          } else {
            // 直接从元素中提取文本
            let text = descriptionElement.textContent.trim();
            // 清理文本
            text = text.replace(/\s+/g, ' ').trim();
            text = text.replace('(展开全部)', '').trim();
            text = text.replace('(收起)', '').trim();
            description = text;
          }
        }
      }
    } catch (e) {
      console.error('提取简介失败:', e);
    }
    console.log('提取的简介长度:', description.length);
    // 限制简介长度，避免显示过长
    if (description.length > 1000) {
      description = description.substring(0, 1000) + '...';
    }
    
    const result = {
      title,
      authors,
      publisher,
      publishDate,
      isbn,
      rating,
      ratingCount,
      cover,
      description
    };
    
    console.log('解析结果:', result);
    return result;
  } catch (error) {
    console.error('解析书籍信息失败:', error);
    // 返回默认值
    return {
      title: '未知书名',
      authors: [],
      publisher: '',
      publishDate: '',
      isbn: '',
      rating: '暂无评分',
      ratingCount: '',
      cover: '',
      description: ''
    };
  }
}

// 显示书籍信息
function showBookInfo(bookInfo) {
  // 检查是否已存在信息窗口
  if (document.getElementById('book-info-window')) {
    document.getElementById('book-info-window').remove();
  }
  
  // 创建信息窗口
  const infoWindow = document.createElement('div');
  infoWindow.id = 'book-info-window';
  infoWindow.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 400px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  // 创建标题
  const title = document.createElement('h3');
  title.textContent = '书籍信息';
  title.style.cssText = `
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  `;
  infoWindow.appendChild(title);
  
  // 创建书籍信息内容
  const content = document.createElement('div');
  content.style.cssText = `
    display: flex;
    gap: 20px;
  `;
  
  // 封面
  if (bookInfo.cover) {
    const coverElement = document.createElement('div');
    coverElement.style.cssText = `
      flex-shrink: 0;
    `;
    
    const img = document.createElement('img');
    img.src = bookInfo.cover;
    img.style.cssText = `
      width: 120px;
      height: auto;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;
    
    coverElement.appendChild(img);
    content.appendChild(coverElement);
  }
  
  // 信息
  const infoContent = document.createElement('div');
  infoContent.style.cssText = `
    flex: 1;
  `;
  
  // 书名
  const bookTitle = document.createElement('div');
  bookTitle.style.cssText = `
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
  `;
  bookTitle.textContent = bookInfo.title;
  infoContent.appendChild(bookTitle);
  
  // 作者
  if (bookInfo.authors.length > 0) {
    const bookAuthors = document.createElement('div');
    bookAuthors.style.cssText = `
      font-size: 14px;
      margin-bottom: 6px;
      color: #666;
    `;
    bookAuthors.textContent = `作者: ${bookInfo.authors.join(', ')}`;
    infoContent.appendChild(bookAuthors);
  }
  
  // 出版社
  if (bookInfo.publisher) {
    const bookPublisher = document.createElement('div');
    bookPublisher.style.cssText = `
      font-size: 14px;
      margin-bottom: 6px;
      color: #666;
    `;
    bookPublisher.textContent = `出版社: ${bookInfo.publisher}`;
    infoContent.appendChild(bookPublisher);
  }
  
  // 出版年
  if (bookInfo.publishDate) {
    const bookPublishDate = document.createElement('div');
    bookPublishDate.style.cssText = `
      font-size: 14px;
      margin-bottom: 6px;
      color: #666;
    `;
    bookPublishDate.textContent = `出版年: ${bookInfo.publishDate}`;
    infoContent.appendChild(bookPublishDate);
  }
  
  // ISBN
  if (bookInfo.isbn) {
    const bookIsbn = document.createElement('div');
    bookIsbn.style.cssText = `
      font-size: 14px;
      margin-bottom: 6px;
      color: #666;
    `;
    bookIsbn.textContent = `ISBN: ${bookInfo.isbn}`;
    infoContent.appendChild(bookIsbn);
  }
  
  // 评分
  if (bookInfo.rating) {
    const bookRating = document.createElement('div');
    bookRating.style.cssText = `
      font-size: 14px;
      margin-bottom: 6px;
      color: #666;
    `;
    bookRating.textContent = `评分: ${bookInfo.rating} (${bookInfo.ratingCount || 0}人评价)`;
    infoContent.appendChild(bookRating);
  }
  
  content.appendChild(infoContent);
  infoWindow.appendChild(content);
  
  // 简介
  if (bookInfo.description) {
    const bookDescription = document.createElement('div');
    bookDescription.style.cssText = `
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    `;
    
    const descriptionTitle = document.createElement('h4');
    descriptionTitle.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    `;
    descriptionTitle.textContent = '简介';
    bookDescription.appendChild(descriptionTitle);
    
    const descriptionText = document.createElement('div');
    descriptionText.style.cssText = `
      font-size: 14px;
      line-height: 1.5;
      color: #666;
      white-space: pre-wrap;
    `;
    descriptionText.textContent = bookInfo.description;
    bookDescription.appendChild(descriptionText);
    
    infoWindow.appendChild(bookDescription);
  }
  
  // 关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
    margin-top: 20px;
    padding: 8px 16px;
    background: #f3f4f6;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  
  closeButton.addEventListener('click', () => {
    infoWindow.remove();
  });
  
  infoWindow.appendChild(closeButton);
  
  // 添加到文档
  document.body.appendChild(infoWindow);
}

// 卸载插件
async function unload() {
  console.log(`${pluginName} unloading...`);
  try {
    // 关闭所有打开的窗口
    if (document.getElementById('book-info-window')) {
      document.getElementById('book-info-window').remove();
    }
    
    // 注销块菜单命令
    orca.blockMenuCommands.unregisterBlockMenuCommand(blockMenuCommand);
    console.log(`[${pluginName}] Block menu command unregistered: ${blockMenuCommand}`);
  } catch (error) {
    console.error(`[${pluginName}] Error during unload:`, error);
  }
  console.log(`${pluginName} unloaded.`);
}

export {
  load,
  unload
};