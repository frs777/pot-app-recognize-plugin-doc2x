/**
 * Pot Recognize Plugin – Doc2X API v2 · 最终修正版 (v1.5)
 * 新增：LaTeX 格式转换 & Obsidian 适配 & 调试模式
 */

/**
 * 转换 LaTeX 公式格式为 Obsidian 格式
 * @param {string} content - Markdown 内容
 * @returns {string} 转换后的内容
 */
function convertToObsidianFormat(content) {
  // \( ... \) → $...$  (行内公式)
  content = content.replace(/\\\((.*?)\\\)/g, "$$$1$$");
  
  // \[ ... \] → $$...$$ (块级公式)
  content = content.replace(/\\\[(.*?)\\\]/gs, "$$$$$$1$$$$");
  
  // 移除 $ 内侧的空格：$ xxx $ → $xxx$
  // 处理行内公式
  content = content.replace(/\$\s+/g, "$");  // $ 后面的空格
  content = content.replace(/\s+\$/g, "$");  // $ 前面的空格
  
  // 处理块级公式（注意：要在行内公式之后处理，避免干扰）
  content = content.replace(/\$\$\s+/g, "$$");  // $$ 后面的空格
  content = content.replace(/\s+\$\$/g, "$$");  // $$ 前面的空格
  
  return content;
}

async function recognize(base64, _lang, { config, utils }) {
    /* ---------- 工具 ---------- */
    const fetch = utils.network?.fetch ?? utils.http?.fetch ?? utils.tauriFetch;
    const Body  = utils.network?.Body  ?? utils.http?.Body;
    if (!fetch || !Body) throw Error("找不到网络请求工具");
  
    /* ---------- 校验 Key ---------- */
    const apikey = config.apikey?.trim();
    if (!apikey) throw Error("请先在插件设置里填写 Doc2X API Key");
  
    /* ---------- 获取配置 ---------- */
    const mathFormat = config.mathFormat ?? "latex";
    const showDebug = config.showDebug === "true";
  
    /* ---------- Base64 → Uint8Array ---------- */
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  
    /* ---------- 发送 OCR 请求 ---------- */
    const res = await fetch(
      "https://v2.doc2x.noedgeai.com/api/v2/parse/img/layout",
      { method: "POST",
        headers: { Authorization: `Bearer ${apikey}` },
        body: Body.bytes(bytes),
        responseType: 2,          // 期望 JSON，但某些 Pot 版本仍会返回字符串
        timeout: 60000 }
    );
  
    /* ---------- HTTP 级错误 ---------- */
    if (!res.ok) {
      throw Error(`HTTP ${res.status}: ${JSON.stringify(res.data ?? {})}`);
    }
  
    /* ---------- 解析 res.data ---------- */
    let d = res.data;
    if (typeof d === "string") {
      try { d = JSON.parse(d); }
      catch(e) { throw Error(`服务器返回非 JSON: ${d.slice(0,120)}…`); }
    }
  
    /* ---------- 调试模式 ---------- */
    if (showDebug) {
      const page = d?.data?.result?.pages?.[0];
      if (page) {
        return [
          "=".repeat(60),
          "📋 Doc2X API 调试信息",
          "=".repeat(60),
          "",
          "【Markdown 格式】",
          page.md || "(空)",
          "",
          "【LaTeX Dollar 格式】",
          page.md_dollar || "(空)",
          "",
          "【纯文本格式】",
          page.text || "(空)",
          "",
          "【布局信息 JSON】",
          page.layout ? JSON.stringify(page.layout, null, 2) : "(空)",
          "",
          "【完整 Page 对象】",
          JSON.stringify(page, null, 2),
          "",
          "=".repeat(60),
        ].join("\n");
      }
      // 如果没有 page，返回完整响应
      return JSON.stringify(d, null, 2);
    }
  
    /* ---------- 拿结果 ---------- */
    const page = d?.data?.result?.pages?.[0];
    let md = page?.md;
  
    if (md !== undefined && md !== null) {
      // 清理可能的异常格式
      md = md
        .replace(/^##\s*md:\s*"/, "")  // 移除 "## md: " 前缀
        .replace(/"$/, "")              // 移除结尾的引号
        .trim();
      
      // 转换为 Obsidian 格式（如果需要）
      if (mathFormat === "obsidian") {
        md = convertToObsidianFormat(md);
      }
      
      return md;  // 成功：把 Markdown 返回给 Pot
    }
  
    /* ---------- 其它一律报错 ---------- */
    throw Error(`Doc2X 返回异常：${JSON.stringify(d)}`);
  }