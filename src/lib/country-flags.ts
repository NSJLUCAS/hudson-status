// 区域名 → ISO 3166-1 alpha-2 国家代码映射
// 用于 country-flag-icons 库
const regionToCountryCode: Record<string, string> = {
  // 中文
  '香港': 'HK', '日本': 'JP', '新加坡': 'SG', '美国': 'US',
  '德国': 'DE', '韩国': 'KR', '英国': 'GB', '荷兰': 'NL',
  '法国': 'FR', '加拿大': 'CA', '澳大利亚': 'AU', '台湾': 'TW',
  '俄罗斯': 'RU', '中国大陆': 'CN', '中国': 'CN', '印度': 'IN',
  '巴西': 'BR', '波兰': 'PL', '芬兰': 'FI', '瑞典': 'SE',
  '瑞士': 'CH', '意大利': 'IT', '西班牙': 'ES', '土耳其': 'TR',
  '泰国': 'TH', '越南': 'VN', '印尼': 'ID', '印度尼西亚': 'ID',
  '马来西亚': 'MY', '菲律宾': 'PH', '阿根廷': 'AR', '南非': 'ZA',
  '智利': 'CL', '墨西哥': 'MX', '阿联酋': 'AE', '以色列': 'IL',
  '挪威': 'NO', '丹麦': 'DK', '捷克': 'CZ', '罗马尼亚': 'RO',
  '乌克兰': 'UA', '保加利亚': 'BG', '匈牙利': 'HU', '葡萄牙': 'PT',
  '比利时': 'BE', '奥地利': 'AT', '爱尔兰': 'IE', '新西兰': 'NZ',
  '埃及': 'EG', '尼日利亚': 'NG', '哥伦比亚': 'CO', '秘鲁': 'PE',

  // 英文全称
  'Hong Kong': 'HK', 'Japan': 'JP', 'Singapore': 'SG',
  'United States': 'US', 'United States of America': 'US',
  'Germany': 'DE', 'Korea': 'KR', 'South Korea': 'KR',
  'United Kingdom': 'GB', 'UK': 'GB', 'Netherlands': 'NL',
  'France': 'FR', 'Canada': 'CA', 'Australia': 'AU', 'Taiwan': 'TW',
  'Russia': 'RU', 'China': 'CN', 'India': 'IN', 'Brazil': 'BR',
  'Poland': 'PL', 'Finland': 'FI', 'Sweden': 'SE', 'Switzerland': 'CH',
  'Italy': 'IT', 'Spain': 'ES', 'Turkey': 'TR', 'Thailand': 'TH',
  'Vietnam': 'VN', 'Indonesia': 'ID', 'Malaysia': 'MY',
  'Philippines': 'PH', 'Argentina': 'AR', 'South Africa': 'ZA',
  'Chile': 'CL', 'Mexico': 'MX', 'UAE': 'AE', 'Israel': 'IL',
  'Norway': 'NO', 'Denmark': 'DK', 'Czech': 'CZ', 'Czech Republic': 'CZ',
  'Romania': 'RO', 'Ukraine': 'UA', 'Bulgaria': 'BG', 'Hungary': 'HU',
  'Portugal': 'PT', 'Belgium': 'BE', 'Austria': 'AT', 'Ireland': 'IE',
  'New Zealand': 'NZ', 'Egypt': 'EG', 'Nigeria': 'NG',

  // 城市名 → 国家代码
  '东京': 'JP', '大阪': 'JP', '首尔': 'KR', '洛杉矶': 'US',
  '硅谷': 'US', '法兰克福': 'DE', '伦敦': 'GB', 'London': 'GB',
  '阿姆斯特丹': 'NL', '巴黎': 'FR', 'Paris': 'FR',
  '多伦多': 'CA', 'Toronto': 'CA', '温哥华': 'CA',
  '悉尼': 'AU', 'Sydney': 'AU', '墨尔本': 'AU',
  '莫斯科': 'RU', 'Moscow': 'RU', '孟买': 'IN', 'Mumbai': 'IN',
  '圣保罗': 'BR', 'São Paulo': 'BR', '迪拜': 'AE', 'Dubai': 'AE',

  // 两字母代码（直接透传）
  'HK': 'HK', 'JP': 'JP', 'SG': 'SG', 'US': 'US', 'DE': 'DE',
  'KR': 'KR', 'GB': 'GB', 'NL': 'NL', 'FR': 'FR', 'CA': 'CA',
  'AU': 'AU', 'TW': 'TW', 'RU': 'RU', 'CN': 'CN', 'IN': 'IN',
  'BR': 'BR', 'PL': 'PL', 'FI': 'FI', 'SE': 'SE', 'CH': 'CH',
  'IT': 'IT', 'ES': 'ES', 'TR': 'TR', 'TH': 'TH', 'VN': 'VN',
  'ID': 'ID', 'MY': 'MY', 'PH': 'PH', 'AR': 'AR', 'ZA': 'ZA',
  'CL': 'CL', 'MX': 'MX', 'AE': 'AE', 'IL': 'IL', 'NO': 'NO',
  'DK': 'DK', 'CZ': 'CZ', 'RO': 'RO', 'UA': 'UA', 'BG': 'BG',
  'HU': 'HU', 'PT': 'PT', 'BE': 'BE', 'AT': 'AT', 'IE': 'IE',
  'NZ': 'NZ', 'EG': 'EG', 'NG': 'NG',
};

/**
 * 根据区域名获取 ISO 3166-1 alpha-2 国家代码
 */
export function getCountryCode(region: string | undefined | null): string | null {
  if (!region) return null;

  const trimmed = region.trim();
  if (!trimmed) return null;

  // 已是两字母国家代码（大小写不敏感），直接规范化
  if (/^[a-zA-Z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // 精确匹配（原文或 trim 后）
  if (regionToCountryCode[trimmed]) return regionToCountryCode[trimmed];
  if (regionToCountryCode[region]) return regionToCountryCode[region];

  // 部分匹配（用 trim 后的字符串做包含判断，减少误匹配）
  for (const [key, code] of Object.entries(regionToCountryCode)) {
    if (trimmed.includes(key) || key.includes(trimmed)) return code;
  }

  return null;
}

/**
 * 与 `CountryFlag` 组件、服务器卡片/弹窗上的国旗一致：对 `node.meta.region`
 *（后端 metadata_region）调用 {@link getCountryCode}，得到 ISO 3166-1 alpha-2。
 *
 * 等价于 `getCountryCode(node.meta.region)`，参见 `components/CountryFlag.tsx`。
 */
export function nodeRegionCountryCode(node: { meta?: { region?: string | null } }): string | null {
  return getCountryCode(node.meta?.region ?? null);
}

/**
 * 获取国家名称（英文）
 */
const countryCodeToName: Record<string, string> = {
  'HK': 'Hong Kong', 'JP': 'Japan', 'SG': 'Singapore', 'US': 'United States',
  'DE': 'Germany', 'KR': 'South Korea', 'GB': 'United Kingdom', 'NL': 'Netherlands',
  'FR': 'France', 'CA': 'Canada', 'AU': 'Australia', 'TW': 'Taiwan',
  'RU': 'Russia', 'CN': 'China', 'IN': 'India', 'BR': 'Brazil',
  'PL': 'Poland', 'FI': 'Finland', 'SE': 'Sweden', 'CH': 'Switzerland',
  'IT': 'Italy', 'ES': 'Spain', 'TR': 'Turkey', 'TH': 'Thailand',
  'VN': 'Vietnam', 'ID': 'Indonesia', 'MY': 'Malaysia', 'PH': 'Philippines',
  'AR': 'Argentina', 'ZA': 'South Africa', 'CL': 'Chile', 'MX': 'Mexico',
  'AE': 'UAE', 'IL': 'Israel', 'NO': 'Norway', 'DK': 'Denmark',
  'CZ': 'Czech Republic', 'RO': 'Romania', 'UA': 'Ukraine', 'BG': 'Bulgaria',
  'HU': 'Hungary', 'PT': 'Portugal', 'BE': 'Belgium', 'AT': 'Austria',
  'IE': 'Ireland', 'NZ': 'New Zealand', 'EG': 'Egypt', 'NG': 'Nigeria',
};

export function getCountryName(code: string | null): string {
  if (!code) return 'Unknown';
  return countryCodeToName[code] || code;
}

/** ISO 3166-1 alpha-2 → 中文常用名（筛选标签等） */
const countryCodeToNameZh: Record<string, string> = {
  HK: '香港',
  JP: '日本',
  SG: '新加坡',
  US: '美国',
  DE: '德国',
  KR: '韩国',
  GB: '英国',
  NL: '荷兰',
  FR: '法国',
  CA: '加拿大',
  AU: '澳大利亚',
  TW: '台湾',
  RU: '俄罗斯',
  CN: '中国',
  IN: '印度',
  BR: '巴西',
  PL: '波兰',
  FI: '芬兰',
  SE: '瑞典',
  CH: '瑞士',
  IT: '意大利',
  ES: '西班牙',
  TR: '土耳其',
  TH: '泰国',
  VN: '越南',
  ID: '印度尼西亚',
  MY: '马来西亚',
  PH: '菲律宾',
  AR: '阿根廷',
  ZA: '南非',
  CL: '智利',
  MX: '墨西哥',
  AE: '阿联酋',
  IL: '以色列',
  NO: '挪威',
  DK: '丹麦',
  CZ: '捷克',
  RO: '罗马尼亚',
  UA: '乌克兰',
  BG: '保加利亚',
  HU: '匈牙利',
  PT: '葡萄牙',
  BE: '比利时',
  AT: '奥地利',
  IE: '爱尔兰',
  NZ: '新西兰',
  EG: '埃及',
  NG: '尼日利亚',
};

export function getCountryNameZh(code: string | null): string {
  if (!code) return '未知';
  return countryCodeToNameZh[code] || countryCodeToName[code] || code;
}
