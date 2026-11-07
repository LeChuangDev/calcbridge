/** 浏览器端文本文件下载（报告、设计文件、数据文件共用）。 */
export function downloadTextFile(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  // 必须挂到文档上再点击，否则部分浏览器不会触发下载。
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
