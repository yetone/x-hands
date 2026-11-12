// 点工具栏图标：在当前 X 页面里再演一遍
chrome.action.onClicked.addListener(tab => {
  if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'x-hands:play' }).catch(() => {});
});
