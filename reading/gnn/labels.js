// Translate controls without modifying the original graph bundle or option values.
if (document.documentElement.lang === 'zh-CN') {
  const terms = new Map([
    ['Task', '任务'],
    ['Model Options', '模型设置'],
    ['Model AUC', '模型 AUC'],
    ['Depth', '层数'],
    ['1 layer', '1 层'],
    ['2 layers', '2 层'],
    ['3 layers', '3 层'],
    ['4 layers', '4 层'],
    ['Aggregation function', '聚合函数'],
    ['Mean', '均值'],
    ['Sum', '求和'],
    ['Max', '最大值'],
    ['Node embedding size', '节点嵌入维度'],
    ['Edge embedding size', '边嵌入维度'],
    ['Global embedding size', '全局嵌入维度'],
    ['Reset', '重置'],
    ['Model Prediction', '模型预测'],
    ['Ground Truth', '参考标签'],
    ['epoch:', '训练轮次：'],
  ]);
  const targets = '.model-info-title,.model-param,label,option,.simple-title,#reset,#epoch-slider-holder div';
  const playground = document.getElementById('playground');
  const translate = () => {
    for (const element of playground.querySelectorAll(targets)) {
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const phrase = node.data.trim();
        if (terms.has(phrase)) node.data = node.data.replace(phrase, terms.get(phrase));
      }
    }
  };
  new MutationObserver(translate).observe(playground, {childList: true, subtree: true});
  translate();
}
