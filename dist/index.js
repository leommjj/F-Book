/**
 * 链接元数据提取工具
 * 从网页中提取元数据，支持规则匹配和自定义提取脚本
 * 
 * 功能特点：
 * 1. 从块内容中自动查找URL
 * 2. 支持基于正则表达式的URL规则匹配
 * 3. 静态方式提取元数据（基于fetch和DOMParser）
 * 4. 浏览器模式提取元数据（需要支持webview的环境）
 * 5. 支持自定义JavaScript提取脚本
 * 6. 支持下载封面图片到本地
 * 
 * 使用示例：
 * 
 * // 1. 导入模块
 * const { handleBlockExtraction, handleOpenBrowser, PropType } = require('./link-metadata-extractor');
 * 
 * // 2. 定义提取规则
 * const rules = [
 *   {
 *     name: "Douban Book",
 *     enabled: true,
 *     urlPattern: "/^https:\/\/book\.douban\.com\/subject\/(\\d+)(\/|\\/?\\?.*)?$/i",
 *     tagName: "Book",
 *     downloadCover: true,
 *     script: [
 *       "// 提取豆瓣图书信息",
 *       "const match = url.match(/\\/subject\\/(\\d+)/);",
 *       "const bookId = match ? match[1] : '';",
 *       "",
 *       "// 提取标题",
 *       "const title = doc.querySelector('h1 span')?.textContent?.trim() || baseMeta.find(m => m.name === '标题')?.value || '';",
 *       "",
 *       "// 提取作者",
 *       "const authorNodes = doc.querySelectorAll('.info .attrs a');",
 *       "const authors = Array.from(authorNodes).map(a => a.textContent?.trim()).filter(a => a);",
 *       "",
 *       "// 提取封面",
 *       "const cover = doc.querySelector('#mainpic img')?.src || baseMeta.find(m => m.name === '封面')?.value || '';",
 *       "",
 *       "// 提取评分",
 *       "const rating = doc.querySelector('.rating_num')?.textContent?.trim() || '';",
 *       "",
 *       "// 提取简介",
 *       "const introNode = doc.querySelector('#link-report .intro');",
 *       "const intro = introNode ? introNode.textContent?.trim().replace(/\\s+/g, ' ') : '';",
 *       "",
 *       "// 返回元数据",
 *       "return [",
 *       "  { name: '链接', type: PropType.Text, value: url, typeArgs: { subType: 'link' } },",
 *       "  { name: '标题', type: PropType.Text, value: title },",
 *       "  { name: '作者', type: PropType.Text, value: authors.join(' / ') },",
 *       "  { name: '评分', type: PropType.Number, value: rating ? parseFloat(rating) : 0 },",
 *       "  { name: '封面', type: PropType.Text, value: cover, typeArgs: { subType: 'image' } },",
 *       "  { name: '简介', type: PropType.Text, value: intro },",
 *       "  { name: '图书ID', type: PropType.Text, value: bookId }",
 *       "];",
 *     ]
 *   },
 *   {
 *     name: "Generic",
 *     enabled: true,
 *     urlPattern: ".*",
 *     tagName: "Bookmark",
 *     downloadCover: false,
 *     script: [
 *       "// 返回通用元数据",
 *       "return baseMeta;",
 *     ]
 *   }
 * ];
 * 
 * // 3. 定义快速访问链接
 * const quickLinks = [
 *   {
 *     name: "Douban Search",
 *     url: "https://www.douban.com/search"
 *   },
 *   {
 *     name: "Google",
 *     url: "https://www.google.com"
 *   }
 * ];
 * 
 * // 4. 处理块的元数据提取
 * async function extractFromBlock(block) {
 *   try {
 *     const result = await handleBlockExtraction(block, rules);
 *     console.log('Extraction result:', result);
 *     // 应用元数据到块
 *     await applyMetadataToBlock(
 *       block.id,
 *       result.rule.tagName,
 *       result.metadata,
 *       result.rule.downloadCover
 *     );
 *   } catch (error) {
 *     console.error('Extraction failed:', error);
 *   }
 * }
 * 
 * // 5. 使用浏览器模式提取
 * async function extractWithBrowser(url, block) {
 *   try {
 *     await handleOpenBrowser(url, block, rules, quickLinks);
 *   } catch (error) {
 *     console.error('Browser mode failed:', error);
 *   }
 * }
 * 
 * 注意：
 * - 浏览器模式需要在支持webview的环境中运行
 * - 静态提取可能会受到CORS限制
 * - 自定义脚本中可以使用以下变量：
 *   - doc: HTML文档对象
 *   - url: 当前URL
 *   - cleanUrl: 清理后的URL（移除查询参数和哈希部分）
 *   - PropType: 数据类型定义
 *   - baseMeta: 通用元数据（标题、链接、封面）
 */

// 数据类型定义
const PropType = {
  JSON: 0,
  Text: 1,
  BlockRefs: 2,
  Number: 3,
  Boolean: 4,
  DateTime: 5,
  TextChoices: 6
};

/**
 * 从块内容中查找URL
 * @param {Object} block - 块对象
 * @returns {string} 找到的URL，若未找到则返回空字符串
 */
function findUrlInBlock(block) {
  if (!block || !block.content) return "";
  for (const item of block.content) {
    if (item.t === "a" && item.url) {
      return item.url;
    }
    if (typeof item.v === "string" && item.v.includes("http")) {
      const match = item.v.match(/https?:\/\/[^\s]+/);
      if (match) {
        return match[0];
      }
    }
  }
  return "";
}

/**
 * 清理URL，移除查询参数和哈希部分
 * @param {string} url - 原始URL
 * @returns {string} 清理后的URL
 */
function cleanUrl(url) {
  return url.split('?')[0].split('#')[0];
}

/**
 * 从HTML文档中提取通用元数据
 * @param {Document} doc - HTML文档对象
 * @param {string} url - 原始URL
 * @returns {Array} 元数据数组
 */
function getGenericMetadata(doc, url) {
  const title = (doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() || 
                doc.querySelector("title")?.textContent?.trim() || "");
  const image = (doc.querySelector("meta[property='og:image']")?.getAttribute("content") || 
                doc.querySelector("meta[name='og:image']")?.getAttribute("content") || 
                doc.querySelector("link[rel='icon']")?.getAttribute("href") || "");
  
  return [
    {
      name: "链接",
      type: PropType.Text,
      value: url,
      typeArgs: { subType: "link" }
    },
    {
      name: "标题",
      type: PropType.Text,
      value: title
    },
    {
      name: "封面",
      type: PropType.Text,
      typeArgs: { subType: "image" },
      value: image
    }
  ];
}

/**
 * 根据URL匹配提取规则
 * @param {string} url - 要匹配的URL
 * @param {Array} rules - 提取规则数组
 * @returns {Object|null} 匹配的规则，若未找到则返回null
 */
function matchRule(url, rules) {
  return rules.find((rule) => {
    if (!rule.enabled) return false;
    try {
      let regex;
      const pattern = rule.urlPattern.trim();
      if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
        const lastSlashIndex = pattern.lastIndexOf("/");
        const regexPattern = pattern.substring(1, lastSlashIndex);
        const flags = pattern.substring(lastSlashIndex + 1);
        regex = new RegExp(regexPattern, flags);
      } else {
        regex = new RegExp(pattern, "i");
      }
      return regex.test(url);
    } catch {
      return false;
    }
  });
}

/**
 * 验证URL是否有效
 * @param {string} url - 要验证的URL
 * @returns {boolean} URL是否有效
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 静态方式提取元数据
 * @param {string} url - 要提取元数据的URL
 * @param {Array} scriptLines - 提取脚本行数组
 * @returns {Promise<Array>} 提取的元数据数组
 */
async function extractMetadataStatic(url, scriptLines) {
  try {
    // 验证URL
    if (!url || !isValidUrl(url)) {
      throw new Error("Invalid URL");
    }
    
    const response = await fetch(url, {
      mode: "cors",
      credentials: "include",
      referer: new URL(url).origin,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "upgrade-insecure-requests": "1"
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cleanedUrl = cleanUrl(url);
    const baseMeta = getGenericMetadata(doc, cleanedUrl);
    
    const script = scriptLines.join("\n");
    const extractorFn = new Function(
      "doc",
      "url",
      "PropType",
      "cleanUrl",
      "baseMeta",
      script
    );
    
    const result = extractorFn(doc, cleanedUrl, PropType, cleanUrl, baseMeta);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    throw error;
  }
}

/**
 * 处理块的元数据提取
 * @param {Object} block - 块对象
 * @param {Array} rules - 提取规则数组
 * @returns {Promise<{url: string, metadata: Array, rule: Object}>} 提取结果
 */
async function handleBlockExtraction(block, rules) {
  const url = findUrlInBlock(block);
  if (!url) {
    throw new Error("No URL found in block");
  }
  
  const matchedRule = matchRule(url, rules);
  if (!matchedRule) {
    throw new Error("No matching rule found for this URL");
  }
  
  const metadata = await extractMetadataStatic(url, matchedRule.script);
  return {
    url,
    metadata,
    rule: matchedRule
  };
}

/**
 * 处理属性，包括下载封面图片
 * @param {Array} metadata - 元数据数组
 * @param {boolean} downloadCover - 是否下载封面到本地
 * @returns {Promise<Array>} 处理后的属性数组
 */
async function processProperties(metadata, downloadCover) {
  const processedProperties = [];
  for (const item of metadata) {
    let value = item.value;
    if (downloadCover && item.typeArgs?.subType === "image" && typeof item.value === "string" && (item.value.startsWith("http") || item.value.startsWith("data:"))) {
      try {
        console.log(`Processing cover image: ${item.value}`);
        
        // 检查是否是base64格式的图片
        if (item.value.startsWith('data:')) {
          // 处理base64格式的图片
          console.log('Processing base64 image...');
          
          // 从base64字符串中提取MIME类型和数据
          const match = item.value.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (match) {
            const contentType = match[1];
            const base64Data = match[2];
            
            // 将base64转换为二进制数据
            try {
              const binaryData = atob(base64Data);
              const arrayBuffer = new ArrayBuffer(binaryData.length);
              const uint8Array = new Uint8Array(arrayBuffer);
              
              for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
              }
              
              // 上传到虎鲸的资源文件夹
              const uploadedUrl = await orca.invokeBackend("upload-asset-binary", contentType, arrayBuffer);
              if (uploadedUrl) {
                console.log(`Base64 image uploaded to: ${uploadedUrl}`);
                value = uploadedUrl;
              } else {
                console.error('Failed to upload base64 image');
              }
            } catch (e) {
              console.error('Error processing base64 image:', e);
            }
          } else {
            console.error('Invalid base64 image format');
          }
        } else {
          // 尝试使用虎鲸笔记的内置API下载图片
          try {
            console.log("Trying orca.invokeBackend to download image directly...");
            // 尝试直接使用虎鲸笔记的API上传图片URL
            const uploadedUrl = await orca.invokeBackend("upload-asset-url", item.value);
            if (uploadedUrl) {
              console.log(`Cover uploaded via URL: ${uploadedUrl}`);
              value = uploadedUrl;
            } else {
              throw new Error("upload-asset-url failed");
            }
          } catch (apiError) {
            console.error("API download failed, trying alternative methods:", apiError);
            
            // 尝试使用不同的fetch选项，模拟浏览器请求
            const fetchOptions = {
              mode: 'no-cors', // 使用no-cors模式
              credentials: 'omit',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
              }
            };
            
            const response = await fetch(item.value, fetchOptions);
            if (response.ok) {
              const blob = await response.arrayBuffer();
              const contentType = response.headers.get("content-type") || "image/png";
              const uploadedUrl = await orca.invokeBackend("upload-asset-binary", contentType, blob);
              if (uploadedUrl) {
                console.log(`Cover downloaded to: ${uploadedUrl}`);
                value = uploadedUrl;
              }
            } else {
              console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
          }
        }
      } catch (error) {
        console.error("Error processing cover image", error);
        // 如果所有方法都失败，使用原始图片URL
        console.log(`Using original image URL: ${item.value}`);
      }
    }
    processedProperties.push({
      name: item.name,
      type: item.type,
      value: value,
      typeArgs: item.typeArgs
    });
  }
  return processedProperties;
}

/**
 * 同步标签架构
 * @param {number} tagBlockId - 标签块ID
 * @param {Array} properties - 属���数组
 * @returns {Promise<void>}
 */
async function syncTagSchema(tagBlockId, properties) {
  try {
    const tagBlock = await orca.invokeBackend("get-block", tagBlockId);
    if (!tagBlock) return;
    
    const existingProps = tagBlock.properties || [];
    const propsToUpdate = [];
    
    for (const prop of properties) {
      const existingProp = existingProps.find((p) => p.name === prop.name);
      
      if (!existingProp) {
        propsToUpdate.push({
          name: prop.name,
          type: prop.type,
          typeArgs: prop.typeArgs
        });
      } else if (prop.type === PropType.TextChoices && existingProp.type === PropType.TextChoices) {
        // 合并选项
        const existingChoices = existingProp.typeArgs?.choices || [];
        const existingNames = new Set(existingChoices.map((c) => c.n));
        let hasNew = false;
        
        const newChoices = prop.typeArgs?.choices || [];
        for (const nc of newChoices) {
          if (!existingNames.has(nc.n)) {
            existingChoices.push(nc);
            hasNew = true;
          }
        }
        
        if (hasNew) {
          propsToUpdate.push({
            name: prop.name,
            type: prop.type,
            typeArgs: {
              ...existingProp.typeArgs,
              choices: existingChoices,
              subType: "multi"
            }
          });
        }
      }
    }
    
    if (propsToUpdate.length > 0) {
      await orca.commands.invokeEditorCommand(
        "core.editor.setProperties",
        null,
        [tagBlockId],
        JSON.parse(JSON.stringify(propsToUpdate))
      );
    }
  } catch (error) {
    console.error("Failed to sync tag schema:", error);
  }
}

/**
 * 应用元数据到块
 * @param {number} blockId - 块ID
 * @param {string} tagName - 标签名称
 * @param {Array} metadata - 元数据数组
 * @param {boolean} downloadCover - 是否下载封面到本地
 * @returns {Promise<void>}
 */
async function applyMetadataToBlock(blockId, tagName, metadata, downloadCover) {
  console.log(`Applying metadata to block ${blockId} with tag ${tagName}`);
  console.log('Metadata:', metadata);
  
  try {
    // 处理属性
    const processedProperties = await processProperties(metadata, downloadCover);
    
    // 格式化属性，确保类型正确
    const formattedProperties = processedProperties.map((item) => {
      let value = item.value;
      
      // 处理类型转换
      if (item.type === PropType.DateTime && typeof value === "string") {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = date;
        }
      } else if (item.type === PropType.Number && typeof value === "string") {
        value = parseFloat(value);
      } else if (item.type === PropType.Boolean && typeof value === "string") {
        value = ["true", "yes", "1", "ok"].includes(value.toLowerCase());
      }
      
      // 处理TextChoices类型
      if (item.type === PropType.TextChoices) {
        let choicesValues = [];
        if (Array.isArray(value)) {
          choicesValues = value;
        } else if (typeof value === "string") {
          choicesValues = value.split(" ").map((v) => v.trim()).filter((v) => v);
        }
        
        return {
          name: item.name,
          type: item.type,
          value: choicesValues,
          typeArgs: {
            choices: choicesValues.map((v) => ({ n: v, c: "" })),
            subType: "multi"
          }
        };
      }
      
      // 确保类型参数正确
      const typeArgs = item.typeArgs || {};
      if (item.type === PropType.DateTime && !typeArgs.subType) {
        typeArgs.subType = "datetime";
      }
      
      return {
        name: item.name,
        value: value,
        type: item.type,
        typeArgs: Object.keys(typeArgs).length > 0 ? typeArgs : undefined
      };
    });
    
    // 应用标签和属性，使用与参考插件完全相同的方式
    if (typeof orca !== 'undefined' && orca.commands) {
      console.log('Applying tag with properties:', {
        blockId: blockId,
        tagName: tagName,
        properties: formattedProperties
      });
      
      // 插入标签
      const tagBlockId = await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        blockId,
        tagName,
        formattedProperties
      );
      
      console.log(`Tag ${tagName} applied to block ${blockId}, tagBlockId:`, tagBlockId);
      
      // 同步标签架构
      if (tagBlockId) {
        await syncTagSchema(tagBlockId, formattedProperties);
      }
      
      // 查找标题属性并更新块内容
      console.log('Looking for title property in:', formattedProperties);
      const titleProperty = formattedProperties.find(p => p.name === "标题");
      console.log('Found title property:', titleProperty);
      
      if (titleProperty && titleProperty.value) {
        try {
          // 用《》包裹标题
          const wrappedTitle = `《${titleProperty.value}》`;
          console.log('Wrapped title:', wrappedTitle);
          console.log('Block ID:', blockId);
          console.log('Orca commands available:', typeof orca !== 'undefined' && orca.commands);
          
          // 更新块内容为《标题》格式
          const updates = [
            {
              id: blockId,
              content: [{ t: "t", v: wrappedTitle }]
            }
          ];
          console.log('Updates array:', updates);
          
          await orca.commands.invokeEditorCommand(
            "core.editor.setBlocksContent",
            null,
            updates,
            false
          );
          console.log(`Block ${blockId} content updated to: ${wrappedTitle}`);
        } catch (error) {
          console.error("Failed to update block content:", error);
        }
      } else {
        console.log('No title property found or title value is empty');
      }
    } else {
      console.error("Orca commands API not available");
    }
  } catch (error) {
    console.error("Failed to apply metadata:", error);
    throw error;
  }
}

/**
 * 创建URL输入窗口
 * @param {string} initialUrl - 初始URL
 * @returns {Promise<string>} 用户输入的URL
 */
async function createUrlInputModal(initialUrl = "") {
  return new Promise((resolve, reject) => {
    // 创建模态窗口元素
    const modalOverlay = document.createElement("div");
    modalOverlay.style.position = "fixed";
    modalOverlay.style.top = "0";
    modalOverlay.style.left = "0";
    modalOverlay.style.width = "100%";
    modalOverlay.style.height = "100%";
    modalOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modalOverlay.style.display = "flex";
    modalOverlay.style.alignItems = "center";
    modalOverlay.style.justifyContent = "center";
    modalOverlay.style.zIndex = "10000";
    
    const modal = document.createElement("div");
    modal.className = "orca-menu orca-context-menu orca-block-handle-menu";
    modal.style.padding = "20px";
    modal.style.borderRadius = "8px";
    modal.style.width = "400px";
    modal.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
    
    const title = document.createElement("h3");
    title.textContent = "输入搜索文本";
    title.className = "orca-panels-container";
    title.style.marginTop = "0";
    title.style.marginBottom = "16px";
    
    const inputContainer = document.createElement("div");
    inputContainer.style.display = "flex";
    inputContainer.style.gap = "8px";
    
    const input = document.createElement("input");
    input.type = "text";
    input.value = initialUrl;
    input.placeholder = "输入搜索文本，例如：三体";
    input.style.flex = "1";
    input.style.padding = "8px";
    input.style.borderRadius = "4px";
    input.className = "sidebar-opened";
    
    const button = document.createElement("button");
    button.textContent = "搜索";
    button.className = "sidebar-opened";
    button.style.padding = "8px 16px";
    button.style.border = "none";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    
    // 处理输入和按钮点击
    const handleSubmit = () => {
      const searchText = input.value.trim();
      if (searchText) {
        // 构建豆瓣搜索URL
        const url = `https://www.douban.com/search?q=${encodeURIComponent(searchText)}`;
        document.body.removeChild(modalOverlay);
        resolve(url);
      } else {
        alert("请输入搜索文本");
      }
    };
    
    button.addEventListener("click", handleSubmit);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    });
    
    // 处理点击模态窗口外部关闭
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        document.body.removeChild(modalOverlay);
        reject(new Error("Modal closed"));
      }
    });
    
    // 组装模态窗口
    inputContainer.appendChild(input);
    inputContainer.appendChild(button);
    modal.appendChild(title);
    modal.appendChild(inputContainer);
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // 自动聚焦输入框
    input.focus();
  });
}

/**
 * 浏览器模式组件
 * @param {Object} props - 组件属性
 * @param {boolean} props.visible - 是否可见
 * @param {Function} props.onClose - 关闭回调
 * @param {string} props.initialUrl - 初始URL
 * @param {Array} props.rules - 提取规则数组
 * @param {Array} props.quickLinks - 快速访问链接数组
 * @param {Function} props.onExtract - 提取完成回调
 */
function MetadataBrowser({ visible, onClose, initialUrl, rules, quickLinks, onExtract }) {
  const [url, setUrl] = React.useState(initialUrl);
  const [webviewUrl, setWebviewUrl] = React.useState(initialUrl);
  const [matchedRule, setMatchedRule] = React.useState(null);
  const webviewRef = React.useRef(null);
  
  React.useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      setWebviewUrl(initialUrl);
      const rule = matchRule(initialUrl, rules);
      setMatchedRule(rule || null);
    }
  }, [initialUrl]);
  
  React.useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;
    
    const handleNavigate = (e) => {
      if (e.url) {
        setUrl(e.url);
        const rule = matchRule(e.url, rules);
        setMatchedRule(rule || null);
      }
    };
    
    const setupWebview = () => {
      webview.executeJavaScript(`
        document.body.addEventListener('click', (e) => {
          let target = e.target;
          while (target && target.tagName !== 'A') {
            target = target.parentElement;
          }
          if (target && target.tagName === 'A' && target.target === '_blank') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = target.href;
          }
        }, true);
      `);
    };
    
    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate);
    webview.addEventListener("dom-ready", setupWebview);
    
    return () => {
      webview.removeEventListener("did-navigate", handleNavigate);
      webview.removeEventListener("did-navigate-in-page", handleNavigate);
      webview.removeEventListener("dom-ready", setupWebview);
    };
  }, [rules]);
  
  const handleGo = () => {
    setWebviewUrl(url);
  };
  
  const handleExtract = async () => {
    if (!webviewRef.current) return;
    
    let rule = matchedRule;
    if (!rule) {
      const currentUrl = webviewRef.current.getURL();
      rule = matchRule(currentUrl, rules) || null;
    }
    
    if (!rule) {
      orca.notify("warn", "No matching rule for current URL");
      return;
    }
    
    try {
      const extractScript = `
        (() => {
          const PropType = ${JSON.stringify(PropType)};
          
          const cleanUrl = (u) => u.split('?')[0].split('#')[0];
          const url = window.location.href;
          const doc = document;
          
          // Re-implement getGenericMetadata logic for client-side
          const getBaseMeta = () => {
            const title = doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() ||
                        doc.querySelector("title")?.textContent?.trim() ||
                        "";

            const thumbnail = doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
                              doc.querySelector("meta[name='og:image']")?.getAttribute("content") ||
                              doc.querySelector("link[rel='icon']")?.getAttribute("href") ||
                              "";
              
             return { title, thumbnail, url };
          };
          
          // 将图片转换为base64格式
          const imageToBase64 = (imgElement) => {
            return new Promise((resolve) => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve('');
                return;
              }
              
              canvas.width = imgElement.naturalWidth || 300;
              canvas.height = imgElement.naturalHeight || 400;
              
              ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
              
              try {
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                resolve(base64);
              } catch (e) {
                console.error('Error converting image to base64:', e);
                resolve('');
              }
            });
          };
          
          // 获取并转换图片为base64
          const getImageAsBase64 = async (imageUrl) => {
            if (!imageUrl) return '';
            
            try {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              return new Promise((resolve) => {
                img.onload = async () => {
                  const base64 = await imageToBase64(img);
                  resolve(base64);
                };
                img.onerror = () => {
                  console.error('Error loading image:', imageUrl);
                  resolve('');
                };
                img.src = imageUrl;
              });
            } catch (e) {
              console.error('Error getting image as base64:', e);
              return '';
            }
          };
          
          const baseMeta = getBaseMeta();

          // User Rule Script Body
          const userScriptBody = ${JSON.stringify(rule.script.join(`\n`))};
          
          try {
              // Create and execute the function
              // Signature: (doc, url, PropType, cleanUrl, baseMeta)
              const extractorFn = new Function(
                "doc",
                "url",
                "PropType",
                "cleanUrl",
                "baseMeta",
                userScriptBody
              );
              
              const metadata = extractorFn(doc, url, PropType, cleanUrl, baseMeta);
              
              // 处理图片，转换为base64
              const processMetadata = async () => {
                if (!Array.isArray(metadata)) return metadata;
                
                const processedMetadata = [];
                
                for (const item of metadata) {
                  if (item.typeArgs?.subType === "image" && typeof item.value === "string" && item.value.startsWith("http")) {
                    // 尝试将图片转换为base64
                    const base64Image = await getImageAsBase64(item.value);
                    if (base64Image) {
                      processedMetadata.push({
                        ...item,
                        value: base64Image
                      });
                    } else {
                      processedMetadata.push(item);
                    }
                  } else {
                    processedMetadata.push(item);
                  }
                }
                
                return processedMetadata;
              };
              
              return processMetadata();
          } catch(err) {
              return { error: err.toString() };
          }
        })()
      `;
      
      const result = await webviewRef.current.executeJavaScript(extractScript);
      
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      if (Array.isArray(result)) {
        onExtract && onExtract(result, rule);
      } else {
        orca.notify("error", "Script returned invalid data");
      }
    } catch (error) {
      console.error("Failed to extract metadata:", error);
      orca.notify("error", `提取元数据失败: ${error.message}`);
    }
  };
  
  if (!visible) return null;
  
  const Button = orca.components.Button;
  const Input = orca.components.Input;
  const ModalOverlay = orca.components.ModalOverlay;
  
  return React.createElement(ModalOverlay, {
    visible: true,
    onClose: onClose,
    blurred: true,
    style: {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("div", {
    className: "sidebar-opened",
    style: {
      padding: "20px",
      borderRadius: "8px",
      width: "80%",
      height: "80vh",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)"
    }
  }, [
    React.createElement("div", {
      key: "header",
      style: {
        display: "flex",
        alignItems: "center",
        marginBottom: "12px"
      }
    }, [
      React.createElement("div", {
        key: "title",
        className: "orca-panels-container",
        style: { fontSize: "1.2rem", fontWeight: "bold" }
      }, [
        "浏览器模式",
        " - ",
        matchedRule ? matchedRule.name : "通用"
      ]),
      React.createElement(Button, {
        key: "close",
        variant: "plain",
        onClick: onClose
      }, React.createElement("i", {
        className: "ti ti-x",
        style: { fontSize: "20px" }
      }))
    ]),
    React.createElement("div", {
      key: "nav",
      style: {
        display: "flex",
        gap: "8px",
        marginBottom: "12px"
      }
    }, [
      React.createElement(Input, {
        key: "url-input",
        value: url,
        onChange: (e) => setUrl(e.target.value),
        placeholder: "URL",
        className: "sidebar-opened",
        style: {
          flex: 1,
          borderRadius: "4px"
        }
      }),
      React.createElement(Button, {
        key: "go",
        variant: "outline",
        onClick: handleGo,
        className: "sidebar-opened"
      }, "前往"),
      React.createElement(Button, {
        key: "extract",
        variant: "solid",
        onClick: handleExtract,
        className: "sidebar-opened"
      }, "提取元数据")
    ]),
    React.createElement("div", {
      key: "quick-links",
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginBottom: "12px"
      }
    }, quickLinks.map((link, index) => React.createElement(Button, {
      key: index,
      variant: "plain",
      onClick: () => {
        setUrl(link.url);
        setWebviewUrl(link.url);
      },
      className: "sidebar-opened",
      style: {
        fontSize: "0.85rem",
        padding: "2px 8px",
        height: "24px"
      }
    }, link.name || link.url))),
    React.createElement("div", {
      key: "webview-container",
      style: {
        flex: 1,
        border: "1px solid var(--b3-theme-surface-lighter)",
        borderRadius: "4px",
        overflow: "hidden",
        position: "relative"
      }
    }, React.createElement("webview", {
      ref: webviewRef,
      src: webviewUrl,
      style: { width: "100%", height: "100%", display: "flex" },
      partition: "persist:douban",
      httpreferrer: "https://www.douban.com/"
    }))
  ]));
}
async function handleOpenBrowser(url, block, rules, quickLinks) {
  try {
    // 如果URL为空或无效，显示输入窗口
    if (!url || !isValidUrl(url)) {
      try {
        url = await createUrlInputModal(url);
      } catch (error) {
        console.log('Modal closed:', error);
        return;
      }
    }
    
    // 创建模态容器
    const modalContainer = document.createElement("div");
    modalContainer.id = "metadata-browser-modal";
    document.body.appendChild(modalContainer);
    
    // 使用ReactDOM创建根元素
    const { createRoot } = window;
    const root = createRoot(modalContainer);
    
    // 处理提取完成
    const handleExtract = async (metadata, rule) => {
      try {
        if (block) {
          // 应用元数据到块
          await applyMetadataToBlock(
            block.id,
            rule.tagName || 'Bookmark',
            metadata,
            rule.downloadCover || false
          );
          orca.notify("success", "元数据已应用到块");
        } else {
          // 保存到每日笔记
          console.log('Saving to daily note:', metadata);
          orca.notify("success", "元数据已保存到每日笔记");
        }
        // 关闭模态窗口
        root.unmount();
        modalContainer.remove();
      } catch (error) {
        console.error("Failed to apply metadata:", error);
        orca.notify("error", `应用元数据失败: ${error.message}`);
      }
    };
    
    // 渲染浏览器组件
    root.render(React.createElement(MetadataBrowser, {
      visible: true,
      onClose: () => {
        root.unmount();
        modalContainer.remove();
      },
      initialUrl: url,
      rules: rules,
      quickLinks: quickLinks,
      onExtract: handleExtract
    }));
  } catch (error) {
    console.error('Browser mode extraction failed:', error);
    // 如果是URL无效错误，不显示错误提示，因为用户可能已经取消了输入
    if (error.message !== 'Invalid URL' && error.message !== 'Modal closed') {
      orca.notify("error", `浏览器模式提取失败: ${error.message}`);
    }
  }
}

// 默认提取规则
const defaultRules = [
  {
    name: "Douban Book",
    enabled: true,
    urlPattern: "/^https:\/\/book\.douban\.com\/subject\/(\\d+)(\/|\\/?\\?.*)?$/i",
    tagName: "书籍",
    downloadCover: true,
    script: [
      "// 提取豆瓣图书信息",
      "const match = url.match(/\\/subject\\/(\\d+)/);",
      "const bookId = match ? match[1] : '';",
      "",
      "// 辅助函数：根据文本查找元素",
      "const findElementByText = (text) => {",
      "  const elements = doc.querySelectorAll('span.pl');",
      "  for (const el of elements) {",
      "    if (el.textContent.includes(text)) return el;",
      "  }",
      "  return null;",
      "};",
      "",
      "// 提取标题",
      "const titleElement = doc.querySelector('h1 span');",
      "const title = (titleElement && titleElement.textContent.trim()) || baseMeta.find(m => m.name === '标题')?.value || '';",
      "",
      "// 提取作者",
      "const authorElement = doc.querySelector('#info span:first-child a');",
      "const author = (authorElement && authorElement.textContent.trim()) || '';",
      "",
      "// 提取封面",
      "const coverElement = doc.querySelector('#mainpic img');",
      "const cover = (coverElement && coverElement.getAttribute('src').trim()) || baseMeta.find(m => m.name === '封面')?.value || '';",
      "",
      "// 提取评分",
      "const rating = doc.querySelector('.rating_num')?.textContent?.trim() || '';",
      "",
      "// 提取简介",
      "const introNode = doc.querySelector('#link-report .intro');",
      "const intro = introNode ? introNode.textContent?.trim().replace(/\\s+/g, ' ') : '';",
      "",
      "// 提取出版社",
      "const publisherElement = findElementByText('出版社');",
      "const publisher = (publisherElement && publisherElement.nextElementSibling && publisherElement.nextElementSibling.textContent.trim()) || '';",
      "",
      "// 提取出品方",
      "const producerElement = findElementByText('出品方');",
      "const producer = (producerElement && producerElement.nextElementSibling && producerElement.nextElementSibling.textContent.trim()) || '';",
      "",
      "// 提取装帧",
      "const bindingElement = findElementByText('装帧');",
      "const binding = (bindingElement && bindingElement.nextSibling && bindingElement.nextSibling.textContent.trim()) || '';",
      "",
      "// 提取副标题",
      "const subtitleElement = findElementByText('副标题');",
      "const subtitle = (subtitleElement && subtitleElement.nextSibling && subtitleElement.nextSibling.textContent.trim()) || '';",
      "",
      "// 提取出版年",
      "const publishDateElement = findElementByText('出版年');",
      "const publishDate = (publishDateElement && publishDateElement.nextSibling && publishDateElement.nextSibling.textContent.trim()) || '';",
      "",
      "// 提取页数",
      "const pagesElement = findElementByText('页数');",
      "const pages = (pagesElement && pagesElement.nextSibling && pagesElement.nextSibling.textContent.trim()) || '';",
      "",
      "// 提取定价",
      "const priceElement = findElementByText('定价');",
      "const price = (priceElement && priceElement.nextSibling && priceElement.nextSibling.textContent.trim()) || '';",
      "",
      "// 提取ISBN",
      "const isbnElement = findElementByText('ISBN');",
      "const isbn = (isbnElement && isbnElement.nextSibling && isbnElement.nextSibling.textContent.trim()) || '';",
      "",
      "// 返回元数据",
      "return [",
      "  { name: '链接', type: PropType.Text, value: url, typeArgs: { subType: 'link' } },",
      "  { name: '标题', type: PropType.Text, value: title },",
      "  { name: '作者', type: PropType.Text, value: author },",
      "  { name: '副标题', type: PropType.Text, value: subtitle },",
      "  { name: '出版年', type: PropType.Text, value: publishDate },",
      "  { name: '页数', type: PropType.Text, value: pages },",
      "  { name: '定价', type: PropType.Text, value: price },",
      "  { name: 'ISBN', type: PropType.Text, value: isbn },",
      "  { name: '评分', type: PropType.Number, value: rating ? parseFloat(rating) : 0 },",
      "  { name: '封面', type: PropType.Text, value: cover, typeArgs: { subType: 'image' } },",
      "  { name: '简介', type: PropType.Text, value: intro }",
      "];",
    ]
  },
  {
    name: "Generic",
    enabled: true,
    urlPattern: ".*",
    tagName: "Bookmark",
    downloadCover: false,
    script: [
      "// 返回通用元数据",
      "return baseMeta;",
    ]
  }
];

// 默认快速访问链接
const defaultQuickLinks = [
  {
    name: "Douban Search",
    url: "https://www.douban.com/search"
  },
  {
    name: "Google",
    url: "https://www.google.com"
  }
];

/**
 * 初始化链接元数据提取插件
 * @param {string} pluginName - 插件名称
 */
async function initLinkMetadataPlugin(pluginName) {
  // 注册块菜单命令
  if (typeof orca !== 'undefined' && orca.blockMenuCommands && orca.blockMenuCommands.registerBlockMenuCommand) {
    try {
      orca.blockMenuCommands.registerBlockMenuCommand(
        `${pluginName}.extract-metadata`,
        {
          worksOnMultipleBlocks: false,
          render: (blockId, props, closeMenu) => {
            const MenuText = orca.components.MenuText;
            if (!MenuText) return null;
            
            return React.createElement(React.Fragment, null, [
              React.createElement(MenuText, {
                key: "extract-metadata",
                preIcon: "ti ti-link",
                title: "从网页提取元数据",
                onClick: () => {
                  closeMenu();
                  orca.commands.invokeCommand(`${pluginName}.extract-metadata`, blockId);
                }
              }),
              React.createElement(MenuText, {
                key: "metadata-browser-mode",
                preIcon: "ti ti-world",
                title: "元数据：浏览器模式",
                onClick: async () => {
                  closeMenu();
                  try {
                    const block = await orca.invokeBackend("get-block", blockId);
                    const url = findUrlInBlock(block) || "";
                    await handleOpenBrowser(url, block, defaultRules, defaultQuickLinks);
                  } catch (error) {
                    console.error("Failed to open browser mode:", error);
                    orca.notify("error", "打开浏览器模式失败");
                  }
                }
              })
            ]);
          }
        }
      );
    } catch (error) {
      console.log(`Block menu command already registered: ${error.message}`);
    }
  }
  
  // 注册命令
  if (typeof orca !== 'undefined' && orca.commands && orca.commands.registerCommand) {
    try {
      orca.commands.registerCommand(
        `${pluginName}.extract-metadata`,
        async (blockId) => {
          try {
            const block = await orca.invokeBackend("get-block", blockId);
            if (!block) {
              orca.notify("error", "找不到块");
              return;
            }
            
            const result = await handleBlockExtraction(block, defaultRules);
            await applyMetadataToBlock(
              blockId,
              result.rule.tagName,
              result.metadata,
              result.rule.downloadCover
            );
            orca.notify("success", "元数据提取成功");
          } catch (error) {
            console.error("Extraction failed:", error);
            orca.notify("error", `提取失败: ${error.message}`);
          }
        },
        "从网页提取元数据"
      );
    } catch (error) {
      console.log(`Command already registered: ${error.message}`);
    }
  }
  
  // 注册编辑器命令
  if (typeof orca !== 'undefined' && orca.commands && orca.commands.registerEditorCommand) {
    try {
      orca.commands.registerEditorCommand(
        `${pluginName}.open-browser`,
        async ([editor, view, cursor]) => {
          try {
            let blockId = cursor?.anchor?.blockId;
            let url = "";
            
            if (blockId) {
              const block = await orca.invokeBackend("get-block", blockId);
              url = findUrlInBlock(block) || "";
            }
            
            await handleOpenBrowser(url, null, defaultRules, defaultQuickLinks);
          } catch (error) {
            console.error("Failed to open browser:", error);
            orca.notify("error", "打开浏览器失败");
          }
          return null;
        },
        () => {},
        { label: "生成书籍" }
      );
    } catch (error) {
      console.log(`Editor command already registered: ${error.message}`);
    }
  }
  
  console.log(`${pluginName} 链接元数据提取插件初始化完成`);
}

/**
 * 卸载链接元数据提取插件
 * @param {string} pluginName - 插件名称
 */
function unloadLinkMetadataPlugin(pluginName) {
  // 卸载块菜单命令
  if (typeof orca !== 'undefined' && orca.blockMenuCommands && orca.blockMenuCommands.unregisterBlockMenuCommand) {
    orca.blockMenuCommands.unregisterBlockMenuCommand(`${pluginName}.extract-metadata`);
  }
  
  // 卸载命令
  if (typeof orca !== 'undefined' && orca.commands && orca.commands.unregisterCommand) {
    orca.commands.unregisterCommand(`${pluginName}.extract-metadata`);
  }
  
  // 卸载编辑器命令
  if (typeof orca !== 'undefined' && orca.commands && orca.commands.unregisterEditorCommand) {
    orca.commands.unregisterEditorCommand(`${pluginName}.open-browser`);
  }
  
  console.log(`${pluginName} 链接元数据提取插件已卸载`);
}

// 插件名称
const pluginName = "F系列工具箱-Book";

// 加载函数
function load() {
  console.log(`${pluginName} 插件加载中...`);
  initLinkMetadataPlugin(pluginName);
  console.log(`${pluginName} 插件加载完成`);
}

// 卸载函数
function unload() {
  console.log(`${pluginName} 插件卸载中...`);
  unloadLinkMetadataPlugin(pluginName);
  console.log(`${pluginName} 插件卸载完成`);
}

// 标准Orca插件导出
if (typeof orca !== 'undefined') {
  // 兼容旧版Orca
  window.plugin = {
    load,
    unload
  };
  console.log(`${pluginName} 插件接口已导出（兼容模式）`);
}

// ES6模块导出（Orca标准）
export {
  load,
  unload
};

// 模块导出（用于测试或其他环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PropType,
    findUrlInBlock,
    cleanUrl,
    getGenericMetadata,
    matchRule,
    extractMetadataStatic,
    handleBlockExtraction,
    handleOpenBrowser,
    applyMetadataToBlock,
    defaultRules,
    defaultQuickLinks,
    initLinkMetadataPlugin,
    unloadLinkMetadataPlugin,
    load,
    unload
  };
} else if (typeof window !== 'undefined') {
  // 浏览器环境导出
  window.LinkMetadataExtractor = {
    PropType,
    findUrlInBlock,
    cleanUrl,
    getGenericMetadata,
    matchRule,
    extractMetadataStatic,
    handleBlockExtraction,
    handleOpenBrowser,
    applyMetadataToBlock,
    defaultRules,
    defaultQuickLinks,
    initLinkMetadataPlugin,
    unloadLinkMetadataPlugin,
    load,
    unload
  };
}
