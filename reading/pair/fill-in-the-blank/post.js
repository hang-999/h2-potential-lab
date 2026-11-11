/* Copyright 2021 Google LLC. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

// MLIP Lab adaptation: keep the published cache and support a local model service.
function modelBackend(label){let e=document.getElementById('reading-model-backend');if(!e){e=document.createElement('p');e.id='reading-model-backend';e.setAttribute('role','status');document.querySelector('.reading-edition')?.append(e);}e.textContent=label;}
async function post(route, obj) {
  var body = JSON.stringify(obj);
  var cacheKey = body + route;
  // if (route == 'embed_zari_cda') return
  // if (route != 'embed_group_top') return
  // route = 'embed_group'

  if (!window.postCache) postCache = {};
  if (postCache[cacheKey]) return postCache[cacheKey];

  if (cacheKey2filename[cacheKey]) {
    modelBackend('预置模型结果 / Published results');var res = await fetch('data/' + cacheKey2filename[cacheKey]);
  } else {
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      modelBackend('本地 CPU 模型 / Local CPU model');var res = await fetch('../../api/' + route, {method: 'POST', body});
    }
    if (!res || res.status === 404) {
      throw new Error('Local inference is not enabled. Start node serve.cjs --inference and the local model service.');
    }
  }

  if (!res.ok) throw new Error('Inference HTTP ' + res.status);
  var rv = await res.json();
  postCache[cacheKey] = rv;

  return rv;
}

function inferenceStatus(selection, error) {
  const message = readingText(
    'No model result was available for this input. If shown, the chart retains the last successful prediction.',
    '此输入暂无结果。自定义句子需启动本地模型及 node serve.cjs --inference；不会自动发送到远端。图表若有数据，保留的是上次预测。',
  );
  const status = selection.selectAppend('p.reading-inference-error').at({role: 'status'});
  if (error) status.text(message);
  else status.remove();
}

function readingText(english, chinese) {
  return document.documentElement.lang === 'zh-CN' ? chinese : english;
}

// copy(postCache)
// data/post-cache.json
