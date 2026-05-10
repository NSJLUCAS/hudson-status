/** NodeGet 节点展示：格式化、在线判定、标签文案等。 */
import { getCountryCode } from './country-flags';

export const OFFLINE_AFTER_MS = 30_000;

export function isOnline(timestamp?: number | null, now = Date.now()) {
  if (!timestamp) return false;
  const tsMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return now - tsMs < OFFLINE_AFTER_MS;
}

export function getStatusLevel(node: { online: boolean; dynamic: { cpu_usage?: number; total_memory?: number; used_memory?: number } | null }): 'operational' | 'degraded' | 'down' {
  if (!node.online) return 'down';
  const d = node.dynamic;
  if (!d) return 'degraded';
  const cpu = d.cpu_usage ?? 0;
  const memPct = d.total_memory ? ((d.used_memory ?? 0) / d.total_memory) * 100 : 0;
  if (cpu > 90 || memPct > 90) return 'degraded';
  return 'operational';
}

export function formatBytes(bytes: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return '0 B/s';
  if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB/s`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB/s`;
  return `${(bytes / 1073741824).toFixed(2)} GB/s`;
}

export function formatTraffic(bytes: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return '0 B';
  const gb = bytes / 1073741824;
  if (gb < 1) return `${(bytes / 1048576).toFixed(0)} MB`;
  if (gb < 1024) return `${gb.toFixed(1)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

export function formatUptime(seconds: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '未知';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}时 ${minutes}分`;
  if (hours > 0) return `${hours}时 ${minutes}分`;
  return `${minutes}分`;
}

export function getRegionFlag(region: string | undefined | null): string {
  if (!region) return '🌐';

  const flagMap: Record<string, string> = {
    '香港': '🇭🇰', 'Hong Kong': '🇭🇰', 'HK': '🇭🇰',
    '日本': '🇯🇵', 'Japan': '🇯🇵', 'JP': '🇯🇵', '东京': '🇯🇵', '大阪': '🇯🇵',
    '新加坡': '🇸🇬', 'Singapore': '🇸🇬', 'SG': '🇸🇬',
    '美国': '🇺🇸', 'United States': '🇺🇸', 'US': '🇺🇸', '洛杉矶': '🇺🇸', '硅谷': '🇺🇸',
    '德国': '🇩🇪', 'Germany': '🇩🇪', 'DE': '🇩🇪', '法兰克福': '🇩🇪',
    '韩国': '🇰🇷', 'Korea': '🇰🇷', 'KR': '🇰🇷', '首尔': '🇰🇷',
    '英国': '🇬🇧', 'UK': '🇬🇧', 'London': '🇬🇧',
    '荷兰': '🇳🇱', 'Netherlands': '🇳🇱', 'NL': '🇳🇱', '阿姆斯特丹': '🇳🇱',
    '法国': '🇫🇷', 'France': '🇫🇷', 'FR': '🇫🇷',
    '加拿大': '🇨🇦', 'Canada': '🇨🇦', 'CA': '🇨🇦',
    '澳大利亚': '🇦🇺', 'Australia': '🇦🇺', 'AU': '🇦🇺',
    '台湾': '🇹🇼', 'Taiwan': '🇹🇼', 'TW': '🇹🇼',
    '俄罗斯': '🇷🇺', 'Russia': '🇷🇺', 'RU': '🇷🇺',
    '中国大陆': '🇨🇳', 'China': '🇨🇳', 'CN': '🇨🇳',
    '印度': '🇮🇳', 'India': '🇮🇳', 'IN': '🇮🇳',
    '巴西': '🇧🇷', 'Brazil': '🇧🇷', 'BR': '🇧🇷',
    '波兰': '🇵🇱', 'Poland': '🇵🇱', 'PL': '🇵🇱',
    '芬兰': '🇫🇮', 'Finland': '🇫🇮', 'FI': '🇫🇮',
    '瑞典': '🇸🇪', 'Sweden': '🇸🇪', 'SE': '🇸🇪',
    '瑞士': '🇨🇭', 'Switzerland': '🇨🇭', 'CH': '🇨🇭',
    '意大利': '🇮🇹', 'Italy': '🇮🇹', 'IT': '🇮🇹',
    '西班牙': '🇪🇸', 'Spain': '🇪🇸', 'ES': '🇪🇸',
    '土耳其': '🇹🇷', 'Turkey': '🇹🇷', 'TR': '🇹🇷',
    '泰国': '🇹🇭', 'Thailand': '🇹🇭', 'TH': '🇹🇭',
    '越南': '🇻🇳', 'Vietnam': '🇻🇳', 'VN': '🇻🇳',
    '印尼': '🇮🇩', 'Indonesia': '🇮🇩', 'ID': '🇮🇩',
    '马来西亚': '🇲🇾', 'Malaysia': '🇲🇾', 'MY': '🇲🇾',
    '菲律宾': '🇵🇭', 'Philippines': '🇵🇭', 'PH': '🇵🇭',
    '阿根廷': '🇦🇷', 'Argentina': '🇦🇷', 'AR': '🇦🇷',
    '南非': '🇿🇦', 'South Africa': '🇿🇦', 'ZA': '🇿🇦',
    '智利': '🇨🇱', 'Chile': '🇨🇱', 'CL': '🇨🇱',
    '墨西哥': '🇲🇽', 'Mexico': '🇲🇽', 'MX': '🇲🇽',
    '阿联酋': '🇦🇪', 'UAE': '🇦🇪', 'AE': '🇦🇪',
    '以色列': '🇮🇱', 'Israel': '🇮🇱', 'IL': '🇮🇱',
    '挪威': '🇳🇴', 'Norway': '🇳🇴', 'NO': '🇳🇴',
    '丹麦': '🇩🇰', 'Denmark': '🇩🇰', 'DK': '🇩🇰',
    '捷克': '🇨🇿', 'Czech': '🇨🇿', 'CZ': '🇨🇿',
    '罗马尼亚': '🇷🇴', 'Romania': '🇷🇴', 'RO': '🇷🇴',
    '乌克兰': '🇺🇦', 'Ukraine': '🇺🇦', 'UA': '🇺🇦',
    '保加利亚': '🇧🇬', 'Bulgaria': '🇧🇬', 'BG': '🇧🇬',
    '匈牙利': '🇭🇺', 'Hungary': '🇭🇺', 'HU': '🇭🇺',
  };

  // 精确匹配
  if (flagMap[region]) return flagMap[region];

  // 部分匹配
  for (const [key, flag] of Object.entries(flagMap)) {
    if (region.includes(key) || key.includes(region)) return flag;
  }

  return '🌐';
}

export function cpuLabel(staticData: { cpu?: { brand?: string; per_core?: { id: number; brand: string; frequency: number }[]; physical_cores?: number; logical_cores?: number } } | undefined): string {
  const cpu = staticData?.cpu;
  if (!cpu) return '未知';

  const cores = cpu.physical_cores ?? cpu.per_core?.length;
  // 优先使用顶层 brand，其次 per_core[0].brand
  const brand = cpu.brand || cpu.per_core?.[0]?.brand || '';
  const parts: string[] = [];
  if (cores) parts.push(`${cores} 核`);
  if (brand) parts.push(brand);
  return parts.join(' · ') || '未知';
}

export function osLabel(staticData: { system?: { system_name?: string; system_os_version?: string; system_os_long_version?: string; system_version?: string } } | undefined): string {
  const s = staticData?.system;
  if (!s) return '未知';
  if (s.system_os_long_version) return s.system_os_long_version;
  return [s.system_name, s.system_os_version || s.system_version].filter(Boolean).join(' ') || '未知';
}

/** 紧凑展示用系统短名（发行版优先）。 */
export function osShortLabel(
  staticData:
    | {
        system?: {
          system_name?: string;
          system_os_version?: string;
          system_os_long_version?: string;
          system_version?: string;
          distribution_id?: string;
        };
      }
    | undefined
): string {
  const s = staticData?.system;
  const id = s?.distribution_id?.trim();
  if (id) {
    const lower = id.toLowerCase();
    const map: Record<string, string> = {
      debian: 'Debian',
      ubuntu: 'Ubuntu',
      centos: 'CentOS',
      fedora: 'Fedora',
      rocky: 'Rocky',
      almalinux: 'AlmaLinux',
      arch: 'Arch',
      alpine: 'Alpine',
      opensuse: 'openSUSE',
    };
    if (map[lower]) return map[lower];
    return id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();
  }

  const full = osLabel(staticData);
  if (!full || full === '未知') return full;

  const inParen = full.match(/\(\s*([A-Za-z][A-Za-z0-9+.-]*)/);
  if (inParen?.[1]) return inParen[1];

  const known = full.match(
    /\b(Debian|Ubuntu|CentOS|Fedora|Rocky\sLinux|Rocky|AlmaLinux|Alma|Arch\sLinux|Arch|Alpine|Gentoo|openSUSE|SUSE|Windows|FreeBSD|OpenBSD|macOS)\b/i
  );
  if (known?.[1]) return known[1].replace(/\s+/g, ' ').trim();

  const parts = full.trim().split(/\s+/);
  if (parts[0]?.toLowerCase() === 'linux' && parts.length > 1 && parts[1].startsWith('(')) {
    const inner = full.match(/Linux\s*\(\s*([A-Za-z][A-Za-z0-9+.-]*)/i);
    if (inner?.[1]) return inner[1];
  }
  return parts[0] || full;
}

export function kernelLabel(staticData: { system?: { system_kernel?: string; system_kernel_version?: string } } | undefined): string {
  const s = staticData?.system;
  if (!s) return '';
  return [s.system_kernel, s.system_kernel_version].filter(Boolean).join(' ') || '';
}

export function hostNameLabel(staticData: { system?: { system_host_name?: string } } | undefined): string {
  return staticData?.system?.system_host_name || '';
}

export function virtLabel(meta: { virtualization?: string } | undefined, staticData: { system?: { virtualization?: string } } | undefined): string {
  const VIRT_LABELS: Record<string, string> = {
    kvm: 'KVM', lxc: 'LXC', openvz: 'OpenVZ', vmware: 'VMware',
    hyperv: 'Hyper-V', 'hyper-v': 'Hyper-V', xen: 'Xen',
    docker: 'Docker', wsl: 'WSL', dedicated: '独服',
  };

  const normalize = (raw: string) => {
    const key = raw.toLowerCase().trim();
    if (!key || key === 'none') return '';
    return VIRT_LABELS[key] || raw;
  };

  if (meta?.virtualization) {
    const v = normalize(String(meta.virtualization));
    if (v) return v;
  }
  if (staticData?.system?.virtualization) {
    const v = normalize(String(staticData.system.virtualization));
    if (v) return v;
  }
  return '';
}
