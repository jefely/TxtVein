/* TxtVein · 解析层（TxtVein-Lang）
 * 输入：wx1 > cy 35 < 咖啡
 * 输出：已绑定 ID 的 Event 草稿（可能多笔，链式转移会展开）。
 *
 * 这一层只做「文本 → 结构」，不落盘、不渲染。
 * 绑定失败绝不静默创建节点：唯一命中才 ok；多义给 candidates；未命中给 suggest。
 * 标签例外：标签是语义层，允许在 UI 明确提示后自动创建。
 */
(function (root) {
  'use strict';

  const TV = (root.TxtVein = root.TxtVein || {});
  const S = (x) => String(x == null ? '' : x);
  const text = TV.text || (typeof require === 'function' ? require('./text.js') : null);
  const amount = TV.amount || (typeof require === 'function' ? require('./amount.js') : null);
  const date = TV.date || (typeof require === 'function' ? require('./date.js') : null);
  const dictMod = TV.dict || (typeof require === 'function' ? require('./dict.js') : null);

  function err(code, message, extra) {
    return Object.assign({ ok: false, code, error: message, message }, extra || {});
  }

  function isSignedNumber(s) {
    return /^[+-]\d{1,3}$/.test(s);
  }

  function looksLikeDateToken(raw) {
    let s = text ? text.normalizeSign(String(raw == null ? '' : raw)) : String(raw == null ? '' : raw);
    if (text) s = text.toHalfWidthDigits(s);
    if (/^\d{6}$/.test(s) || /^\d{8}$/.test(s)) return true;
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(s)) return true;
    if (s === '0' || s === '1') return true;
    return isSignedNumber(s);
  }

  function stripDomainPrefix(token) {
    const m = S(token).match(/^([PFCHpfch]):(.*)$/);
    if (!m) return { domain: '', rest: token, explicit: false };
    return { domain: m[1].toUpperCase(), rest: m[2], explicit: true };
  }

  function tokenizeFlow(src) {
    let x = text.normalizeOperators(src);
    x = x.replace(/([^\s])#/g, '$1 #');
    x = x.replace(/\s*>\s*/g, ' > ');
    return x.trim().split(/[\s\u3000]+/).filter(Boolean);
  }

  function cleanTagName(raw) {
    return S(raw).trim().replace(/^#/, '').replace(/^-$/, '');
  }

  function ensureSystemNode(dict, which) {
    const id = which === 'gain' ? 'N_sys_gain' : 'N_sys_loss';
    if (dict.nodes[id]) return id;
    const isGain = which === 'gain';
    dict.nodes[id] = {
      zh_name: isGain ? '增益' : '损耗',
      en_name: isGain ? 'Gain' : 'Loss',
      zh_code: isGain ? 'gain' : 'loss',
      en_code: isGain ? 'gain' : 'loss',
      polarity: isGain ? 'B' : 'A',
      type: isGain ? '收入' : '费用',
      form: isGain ? 'outside' : 'steam',
      domain: 'P',
      parent_id: '',
      weight: 0,
      system: true,
      created_at: new Date().toISOString(),
    };
    return id;
  }

  function findPlanSignature(dict, plans, p) {
    return (plans || []).find((x) => x && x.status === 'active'
      && x.from === p.from && x.to === p.to
      && Number(x.amountCents) === Number(p.amountCents)
      && x.period === p.period && x.domain === p.domain);
  }

  /**
   * 解析一行录入。
   *
   * @param {string} raw
   * @param {object} dict  会被原地修改（自动标签、别名、计数器）
   * @param {object} opts  { now, domain, autoCreateTags, plans, legacySpace }
   * @returns {object} ok / events / plan / warning / candidates
   */
  function parseEntry(raw, dict, opts) {
    const o = opts || {};
    const now = o.now instanceof Date ? o.now : new Date();
    const autoCreateTags = o.autoCreateTags !== false;
    let src = text.normalizeOperators(text.normalize(raw)).trim();
    if (!src) return err('EMPTY', '先输入一笔，例如 wx > cy 35 < 咖啡');

    /* 1. 行首域标记：[P] 或 "P: "（注意 P:微信 不算行首域，它是节点前缀） */
    let lineDomain = '';
    let m = src.match(/^\[([PFCHpfch])\]\s*/);
    if (m) {
      lineDomain = m[1].toUpperCase();
      src = src.slice(m[0].length);
    } else if ((m = src.match(/^([PFCHpfch])\s*:\s+/))) {
      lineDomain = m[1].toUpperCase();
      src = src.slice(m[0].length);
    } else if ((m = src.match(/^([PFCHpfch])\s+/))) {
      lineDomain = m[1].toUpperCase();
      src = src.slice(m[0].length);
    }
    if (!src) return err('EMPTY', '只有域标记，没有内容');

    /* 2. 日期：行首 6/8 位、带分隔符日期、0/1/±N */
    let stamp = date.todayStamp(now);
    let dateResolved = null;
    const firstToken = src.split(/[\s\u3000]+/)[0] || '';
    if (looksLikeDateToken(firstToken)) {
      const r = date.resolveDateToken(firstToken, now);
      if (!r.ok) return err('INVALID_DATE', r.error, { token: firstToken });
      stamp = r.stamp;
      dateResolved = r;
      src = src.slice(firstToken.length).replace(/^[\s\u3000]+/, '');
      if (!src) return err('EMPTY', '只有日期，没有流水');
    }

    /* 3. 资金段 / 标签段：第一个 < 切开 */
    const lt = src.indexOf('<');
    const flowPart = lt >= 0 ? src.slice(0, lt) : src;
    const tagPart = lt >= 0 ? src.slice(lt + 1) : '';
    if (!flowPart.trim()) return err('MISSING_FLOW', '缺少转出与转入节点');

    /* 4. 词法：> 变成独立 token；# 前补空格 */
    const tokens = tokenizeFlow(flowPart);
    const nodes = [];
    const quantities = [];
    const inlineTags = [];
    let period = '';
    let separators = 0;
    let sawAmount = false;

    for (let i = 0; i < tokens.length; i += 1) {
      let tok = tokens[i];
      if (tok === '>') {
        if (!nodes.length) return err('MISSING_FROM', '> 左边缺转出节点');
        if (sawAmount) return err('MISSING_TO', '> 右边缺转入节点');
        separators += 1;
        continue;
      }
      if (/^\*[dmy]$/i.test(tok)) {
        period = tok.slice(1).toLowerCase();
        continue;
      }
      if (tok.startsWith('#')) {
        const name = cleanTagName(tok);
        if (name) inlineTags.push(name);
        continue;
      }
      const sp = amount.splitPeriod(tok);
      if (sp.period) {
        period = sp.period;
        tok = sp.token;
      }
      const q = amount.parseQuantity(tok);
      if (q.ok) {
        quantities.push(Object.assign({ raw: tok }, q));
        sawAmount = true;
        continue;
      }
      if (/^[+-]\d/.test(tok)) {
        return err('INVALID_AMOUNT', '金额必须大于 0：' + tok, { token: tok });
      }
      if (sawAmount) {
        return err('EXTRA_TOKEN', '金额之后还有认不出的内容：' + tok, { token: tok });
      }
      nodes.push(tok);
    }

    if (!nodes.length) return err('MISSING_FROM', '缺少转出节点');
    if (nodes.length === 1) {
      if (!quantities.length) {
        return err('INCOMPLETE_FROM', '只写了「' + nodes[0] + '」。补全为：' + nodes[0] + ' > 转入 金额', {
          draft: true, token: nodes[0],
        });
      }
      return err('MISSING_TO', '缺少转入节点，例如 ' + nodes[0] + ' > 餐饮 35', { token: nodes[0] });
    }
    if (separators > 0 && separators !== nodes.length - 1) {
      return err('OPERATOR_COUNT', '> 的数量与节点不匹配（' + nodes.length + ' 个节点需要 ' + (nodes.length - 1) + ' 个 >）');
    }
    if (!quantities.length) {
      return err('MISSING_AMOUNT', '包含 > 但缺少金额，例如 ' + nodes[0] + ' > ' + nodes[1] + ' 35');
    }

    const segments = nodes.length - 1;
    if (quantities.length !== 1 && quantities.length !== segments) {
      return err('AMOUNT_COUNT', '给了 ' + quantities.length + ' 个金额，但这条链有 ' + segments + ' 段');
    }
    const per = quantities.length === 1
      ? Array.from({ length: segments }, () => quantities[0])
      : quantities;
    const timeCount = per.filter((q) => q.unit === 'time').length;
    if (timeCount && timeCount !== per.length) {
      return err('MIXED_UNIT', '金额与时间不能混在同一条链里');
    }
    if (timeCount && segments > 1) {
      return err('TIME_CHAIN', '时间代币只支持单段转移');
    }
    if (timeCount && period) {
      return err('TIME_PLAN', '时间代币暂不支持周期规则');
    }
    for (const q of per) {
      if (q.unit === 'time' && !(q.minutes > 0)) return err('INVALID_AMOUNT', '时间必须大于 0');
      if (q.unit === 'money' && !(q.cents > 0)) return err('INVALID_AMOUNT', '金额必须大于 0');
    }

    /* 5. 节点绑定 */
    const lineDomainExplicit = !!lineDomain;
    const eventDomainGuess = lineDomain || o.domain || 'P';
    const binding = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const token = nodes[i];
      const pref = stripDomainPrefix(token);
      if (pref.explicit && !pref.rest) return err('EMPTY_NODE', '域前缀后面缺节点：' + token);
      const ctxDomain = pref.domain || eventDomainGuess;
      const r = dictMod.resolveAlias(dict, pref.rest, { domain: ctxDomain, lang: o.lang || 'zh' });
      if (!r.ok) {
        if (r.code === 'AMBIGUOUS') {
          return err('AMBIGUOUS', r.error, {
            token: pref.rest,
            role: i === 0 ? 'from' : i === nodes.length - 1 ? 'to' : 'mid',
            tokenIndex: i,
            candidates: r.candidates,
          });
        }
        return err('UNBOUND_NODE', r.error, {
          token: pref.rest,
          role: i === 0 ? 'from' : i === nodes.length - 1 ? 'to' : 'mid',
          tokenIndex: i,
          suggest: {
            zh_name: pref.rest, zh_code: pref.rest,
            domain: ctxDomain, polarity: 'A',
          },
        });
      }
      if (pref.explicit && r.node.domain !== pref.domain) {
        return err('DOMAIN_MISMATCH', '节点「' + pref.rest + '」属于 ' + r.node.domain + ' 域，不是 ' + pref.domain + ' 域', {
          token: pref.rest,
        });
      }
      binding.push({
        role: i === 0 ? 'from' : i === nodes.length - 1 ? 'to' : 'mid',
        token: pref.rest,
        id: r.id,
        node: r.node,
        explicitDomain: pref.explicit,
        via: r.via,
        aliasAdded: !!r.aliasAdded,
        aliasKey: r.aliasKey || '',
        raw: token,
      });
      dictMod.bumpWeight(dict, r.id, 1);
    }

    const fromB = binding[0];
    const toB = binding[binding.length - 1];
    let eventDomain = lineDomain || fromB.node.domain;
    if (lineDomainExplicit && !fromB.explicitDomain && fromB.node.domain !== lineDomain) {
      return err('DOMAIN_MISMATCH', '当前域是 ' + lineDomain + '，但转出节点属于 ' + fromB.node.domain + ' 域；请写 ' + fromB.node.domain + ':' + fromB.token, { token: fromB.token });
    }
    const crossDomain = fromB.node.domain !== toB.node.domain;
    if (crossDomain && !binding.some((b) => b.explicitDomain)) {
      return err('CROSS_DOMAIN_PREFIX_REQUIRED', '跨域转移必须写明确接口前缀，例如 P:' + fromB.token + ' > C:' + toB.token, {
        token: toB.token,
        fromDomain: fromB.node.domain,
        toDomain: toB.node.domain,
      });
    }
    if (crossDomain && lineDomainExplicit && eventDomain !== fromB.node.domain && eventDomain !== toB.node.domain) {
      eventDomain = fromB.node.domain;
    }

    /* 6. 标签树：< 块间父子，块内空格同级 */
    const tagIds = [];
    const tagsCreated = [];
    let parentId = '';
    const blocks = tagPart
      ? tagPart.split('<').map((x) => x.trim()).filter(Boolean)
      : [];
    for (const block of blocks) {
      const names = block.split(/[\s\u3000]+/).filter(Boolean);
      let firstId = '';
      for (const rawName of names) {
        const name = cleanTagName(rawName);
        if (!name) continue;
        const r = dictMod.ensureTag(dict, name, {
          domain: eventDomain,
          parentId,
          lang: o.lang || 'zh',
        });
        if (!r.ok) {
          if (r.code === 'AMBIGUOUS') {
            return err('AMBIGUOUS', r.error, { token: name, role: 'tag', candidates: r.candidates });
          }
          if (!autoCreateTags) {
            return err('UNBOUND_TAG', r.error, { token: name, role: 'tag', suggestTag: name });
          }
          return err('TAG_CREATE_FAILED', r.error, { token: name });
        }
        if (!firstId) firstId = r.id;
        if (!tagIds.includes(r.id)) tagIds.push(r.id);
        if (r.created) tagsCreated.push({ id: r.id, name });
        dictMod.bumpWeight(dict, r.id, 1);
      }
      parentId = firstId || parentId;
    }
    for (const rawName of inlineTags) {
      const name = cleanTagName(rawName);
      if (!name) continue;
      const r = dictMod.ensureTag(dict, name, { domain: eventDomain, parentId: '', lang: o.lang || 'zh' });
      if (!r.ok) {
        if (r.code === 'AMBIGUOUS') {
          return err('AMBIGUOUS', r.error, { token: name, role: 'tag', candidates: r.candidates });
        }
        if (!autoCreateTags) return err('UNBOUND_TAG', r.error, { token: name, role: 'tag', suggestTag: name });
        return err('TAG_CREATE_FAILED', r.error, { token: name });
      }
      if (!tagIds.includes(r.id)) tagIds.push(r.id);
      if (r.created) tagsCreated.push({ id: r.id, name });
    }

    /* 7. 展开链式转移 */
    const chainId = segments > 1 ? dictMod.nextId(dict, 'chain') : '';
    const events = [];
    const pushEvent = (from, to, cents, minutes, extra) => {
      events.push(Object.assign({
        domain: eventDomain,
        date: stamp,
        from,
        to,
        amountCents: minutes > 0 ? 0 : cents,
        minutes: minutes || 0,
        tagIds: tagIds.slice(),
        chainId,
        raw: text.normalize(raw).trim(),
      }, extra || {}));
    };

    for (let i = 0; i < segments; i += 1) {
      pushEvent(binding[i].id, binding[i + 1].id, per[i].cents, per[i].minutes);
    }

    /* 多金额链：中间差额进入损益池，保证中间节点净变动为 0 */
    let lossCents = 0;
    let gainCents = 0;
    if (segments > 1 && quantities.length > 1) {
      for (let i = 1; i < segments; i += 1) {
        const delta = per[i - 1].cents - per[i].cents;
        if (delta > 0) {
          const lossId = ensureSystemNode(dict, 'loss');
          pushEvent(binding[i].id, lossId, delta, 0, { system: true, diff: 'loss' });
          lossCents += delta;
        } else if (delta < 0) {
          const gainId = ensureSystemNode(dict, 'gain');
          pushEvent(gainId, binding[i].id, -delta, 0, { system: true, diff: 'gain' });
          gainCents += -delta;
        }
      }
    }

    /* 8. 周期规则（当前这笔照常生成，同时挂一条计划） */
    events.forEach((e) => { e.crossDomain = crossDomain && !e.system; });
    let plan = null;
    if (period) {
      if (segments > 1) return err('PLAN_CHAIN', '周期规则只支持单段转移');
      const candidate = {
        status: 'active',
        start: stamp,
        lastRun: stamp,
        period,
        domain: eventDomain,
        from: fromB.id,
        to: toB.id,
        amountCents: per[0].cents,
        tagIds: tagIds.slice(),
        raw: text.normalize(raw).trim(),
        createdAt: new Date().toISOString(),
      };
      const same = findPlanSignature(dict, o.plans, candidate);
      plan = Object.assign({ id: same ? same.id : dictMod.nextId(dict, 'plan') }, candidate);
    }

    const fromLabel = dictMod.renderNode(dict, fromB.id, 'PLAIN', o.lang || 'zh');
    const toLabel = dictMod.renderNode(dict, toB.id, 'PLAIN', o.lang || 'zh');
    const tagLabels = tagIds.map((id) => dictMod.renderTag(dict, id, 'PLAIN', o.lang || 'zh'));
    const chainNodes = binding.map((b) => dictMod.renderNode(dict, b.id, 'PLAIN', o.lang || 'zh'));
    const qLabel = (q) => (q.minutes > 0 ? amount.formatTime(q.minutes) : amount.centsToDisplay(q.cents));

    const preview = {
      domain: eventDomain,
      date: stamp,
      from: fromB.id,
      to: toB.id,
      fromLabel,
      toLabel,
      amountCents: per[0].cents,
      minutes: per[0].minutes,
      amountLabel: qLabel(per[0]),
      amounts: per.map(qLabel),
      tagLabels,
      chainNodes,
      text: chainNodes.join(' > ') + ' ' + per.map(qLabel).join(' ')
        + (tagLabels.length ? ' < ' + tagLabels.join(' < ') : ''),
      crossDomain,
      lossCents,
      gainCents,
    };

    const warnings = [];
    if (separators === 0) warnings.push('兼容写法：省略了 >，已按「转出 转入 金额」解析');
    if (dateResolved && dateResolved.relative) warnings.push('相对日期 ' + raw.split(/\s/)[0] + ' 已固化为 ' + stamp);
    if (tagsCreated.length) warnings.push('新建标签：' + tagsCreated.map((x) => x.name).join('、'));
    if (crossDomain) warnings.push('跨域转移：' + fromB.node.domain + ' → ' + toB.node.domain);

    return {
      ok: true,
      kind: 'entry',
      events,
      plan,
      chainId,
      tagsCreated,
      binding,
      preview,
      warnings,
      domain: eventDomain,
      date: stamp,
      period,
      segments,
      crossDomain,
    };
  }

  /** 把一笔 Event 还原成可编辑的输入串（用简码，不用名字）。 */
  function entryTextForEvent(event, dict, opts) {
    const o = opts || {};
    const from = dict.nodes[event.from];
    const to = dict.nodes[event.to];
    const fCode = from ? dictMod.displayCode(dict, event.from, o.lang || 'zh') : event.from;
    const tCode = to ? dictMod.displayCode(dict, event.to, o.lang || 'zh') : event.to;
    const parts = [];
    const dom = event.domain || 'P';
    if (o.includeDomain !== false && dom !== 'P') parts.push(dom);
    if (o.includeDate !== false) parts.push(event.date);
    parts.push(fCode, '>', tCode);
    parts.push(event.minutes > 0 ? amount.formatTime(event.minutes) : String(event.amountCents));
    const tagNames = (event.tagIds || [])
      .map((id) => dict.tags[id])
      .filter(Boolean)
      .map((t) => t.zh_name || t.en_name);
    if (tagNames.length) parts.push('<', tagNames.join(' < '));
    return parts.join(' ');
  }

  TV.parser = {
    parseEntry,
    entryTextForEvent,
    tokenizeFlow,
    looksLikeDateToken,
    stripDomainPrefix,
    ensureSystemNode,
  };

  if (typeof module === 'object' && module.exports) module.exports = TV.parser;
})(typeof globalThis !== 'undefined' ? globalThis : this);
