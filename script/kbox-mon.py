#!/usr/bin/env python3
"""
kbox-mon.py - 系统状态上报客户端（Linux）
默认全部关闭，通过参数开启具体项。单次上报或定时上报。

用法:
  python3 kbox-mon.py --url https://kbox.example.com --token YOUR_TOKEN \
      [--hostname NAME] [--cpu] [--mem] [--disk] [--temp] [--load] [--net] [--ip] [--uptime] [--all] \
      [--extra "任意字符串"] [--custom "约定 JSON"] [--interval N]

--custom 约定 JSON（自定义指标，与 --extra 职责分离）:
  {"category":"系统","custom":[{"label":"电量","type":"percent","value":61,"unit":"%","warn":30,"crit":10,"summary":true}]}
  - category 可选：展示的分类卡片（CPU/内存/磁盘/负载/网络/系统 等），缺省放「自定义」
  - 每项字段：label 数据名(必填)、type 类型(必填，percent/bytes/kb/mb/number/float/string/temp)、
    value 值(必填)、unit 单位、warn/crit 告警阈值、summary 是否上列表页摘要（可选）
  - warn/crit 正值表示「越高越差」（value>=阈值触发，如 CPU 使用率）；负值表示「越低越差」
    （value<=绝对值触发，如电量 "warn":-60,"crit":-20 表示低于 60 告警、低于 20 严重）
  - type=percent/temp 显示比例条；number/float 等数字类型有历史趋势图
  - 结构不符的 JSON 会被忽略（不解析为指标，也不作附件）
--extra 仅作附件展示（任意字符串，只保留最新值）。
"""

import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error


# ─── 采集函数 ───

def collect_cpu():
    """CPU 使用率 + 核数"""
    data = {}
    try:
        with open('/proc/stat') as f:
            line1 = f.readline()
        fields1 = list(map(int, line1.split()[1:]))
        idle1 = fields1[3] + (fields1[4] if len(fields1) > 4 else 0)
        total1 = sum(fields1)

        time.sleep(0.1)

        with open('/proc/stat') as f:
            line2 = f.readline()
        fields2 = list(map(int, line2.split()[1:]))
        idle2 = fields2[3] + (fields2[4] if len(fields2) > 4 else 0)
        total2 = sum(fields2)

        total_diff = total2 - total1
        idle_diff = idle2 - idle1
        if total_diff > 0:
            data['cpu_usage'] = round((total_diff - idle_diff) * 100 / total_diff)
    except Exception:
        pass

    try:
        cores = 0
        with open('/proc/cpuinfo') as f:
            for line in f:
                if line.startswith('processor'):
                    cores += 1
        if cores > 0:
            data['cpu_cores'] = cores
    except Exception:
        pass

    return data


def collect_mem():
    """内存使用率 + swap"""
    data = {}
    try:
        with open('/proc/meminfo') as f:
            meminfo = {}
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    meminfo[parts[0].rstrip(':')] = int(parts[1])

        total = meminfo.get('MemTotal', 0)
        available = meminfo.get('MemAvailable', 0)
        if total > 0:
            used = total - available
            data['mem_total_mb'] = total // 1024
            data['mem_used_mb'] = used // 1024
            data['mem_usage'] = round(used * 100 / total)

        swap_total = meminfo.get('SwapTotal', 0)
        swap_free = meminfo.get('SwapFree', 0)
        if swap_total > 0:
            swap_used = swap_total - swap_free
            data['swap_usage'] = round(swap_used * 100 / swap_total)
    except Exception:
        pass

    return data


def collect_disk():
    """根分区磁盘使用率"""
    data = {}
    try:
        result = subprocess.run(['df', '/'], capture_output=True, text=True, timeout=5)
        lines = result.stdout.strip().split('\n')
        if len(lines) >= 2:
            parts = lines[1].split()
            if len(parts) >= 5:
                total_kb = int(parts[1])
                used_kb = int(parts[2])
                pct = int(parts[4].rstrip('%'))
                data['disk_total_kb'] = total_kb
                data['disk_used_kb'] = used_kb
                data['disk_usage'] = pct
    except Exception:
        pass

    return data


def collect_temp():
    """CPU 温度"""
    data = {}
    try:
        thermal_paths = [
            '/sys/class/thermal/thermal_zone0/temp',
            '/sys/class/thermal/thermal_zone1/temp',
        ]
        for path in thermal_paths:
            if os.path.isfile(path):
                with open(path) as f:
                    raw = int(f.read().strip())
                    data['cpu_temp'] = raw // 1000
                    break

        if 'cpu_temp' not in data:
            try:
                result = subprocess.run(['sensors'], capture_output=True, text=True, timeout=5)
                for line in result.stdout.split('\n'):
                    if 'Core 0:' in line or 'Package id 0:' in line:
                        temp_str = line.split(':')[1].strip().split()[0].lstrip('+').rstrip('°C')
                        data['cpu_temp'] = int(float(temp_str))
                        break
            except Exception:
                pass
    except Exception:
        pass

    return data


def collect_load():
    """系统负载 + 进程数"""
    data = {}
    try:
        with open('/proc/loadavg') as f:
            parts = f.read().split()
            if len(parts) >= 3:
                data['load_1m'] = float(parts[0])
                data['load_5m'] = float(parts[1])
                data['load_15m'] = float(parts[2])
    except Exception:
        pass

    try:
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True, timeout=5)
        data['processes'] = len(result.stdout.strip().split('\n')) - 1
    except Exception:
        pass

    return data


def collect_net():
    """网络接口流量"""
    data = {}
    try:
        iface = None
        with open('/proc/net/dev') as f:
            for line in f:
                parts = line.strip().split(':')
                if len(parts) >= 2:
                    name = parts[0].strip()
                    if name != 'lo':
                        iface = name
                        break

        if iface:
            rx_path = f'/sys/class/net/{iface}/statistics/rx_bytes'
            tx_path = f'/sys/class/net/{iface}/statistics/tx_bytes'
            if os.path.isfile(rx_path):
                with open(rx_path) as f:
                    data['net_rx_bytes'] = int(f.read().strip())
            if os.path.isfile(tx_path):
                with open(tx_path) as f:
                    data['net_tx_bytes'] = int(f.read().strip())
            data['net_iface'] = iface
    except Exception:
        pass

    return data


def collect_lan_ip():
    """内网 IPv4 地址（192.168.0.0/16 网段）"""
    def is_lan(ip):
        try:
            parts = list(map(int, ip.split('.')))
            return len(parts) == 4 and parts[0] == 192 and parts[1] == 168
        except Exception:
            return False

    candidates = []
    # 优先用 ip 命令枚举所有非回环 IPv4
    try:
        result = subprocess.run(['ip', '-4', '-o', 'addr', 'show'], capture_output=True, text=True, timeout=5)
        for line in result.stdout.split('\n'):
            parts = line.split()
            for i, tok in enumerate(parts):
                if tok == 'inet' and i + 1 < len(parts):
                    ip = parts[i + 1].split('/')[0]
                    if ip != '127.0.0.1':
                        candidates.append(ip)
    except Exception:
        pass

    # 兜底：UDP 连接法取默认路由出口 IP（不发数据包，仅触发路由选择）
    if not candidates:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            candidates.append(s.getsockname()[0])
            s.close()
        except Exception:
            pass

    for ip in candidates:
        if is_lan(ip):
            return {'lan_ipv4': ip}
    return {}


def collect_uptime():
    """系统运行时长"""
    data = {}
    try:
        with open('/proc/uptime') as f:
            data['uptime_seconds'] = int(float(f.read().split()[0]))
    except Exception:
        pass

    return data


# ─── 上报 ───

def build_payload(hostname, opts):
    """构建上报 JSON"""
    data = {}

    if opts.cpu:
        data.update(collect_cpu())
    if opts.mem:
        data.update(collect_mem())
    if opts.disk:
        data.update(collect_disk())
    if opts.temp:
        data.update(collect_temp())
    if opts.load:
        data.update(collect_load())
    if opts.net:
        data.update(collect_net())
    if opts.ip:
        data.update(collect_lan_ip())
    if opts.uptime:
        data.update(collect_uptime())

    payload = {'hostname': hostname, 'data': data}
    if opts.extra is not None:
        payload['extra'] = opts.extra
    if opts.custom is not None:
        payload['custom'] = opts.custom
    return payload


def report(url, token, payload):
    """发送上报请求"""
    api_url = url.rstrip('/') + '/api/plugins/sys-monitor/report'
    body = json.dumps(payload).encode('utf-8')

    req = urllib.request.Request(api_url, data=body, method='POST')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('User-Agent', 'curl/8.0')

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                print(f"上报成功 ({time.strftime('%H:%M:%S')})")
            else:
                print(f"上报失败 (HTTP {resp.status})")
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f"上报失败 (HTTP {e.code}): {body}")
    except Exception as e:
        print(f"上报失败: {e}")


def main():
    parser = argparse.ArgumentParser(description='kbox 系统状态上报客户端')
    parser.add_argument('--url', required=True, help='服务端地址')
    parser.add_argument('--token', required=True, help='API 令牌')
    parser.add_argument('--hostname', help='指定主机名（默认自动获取）')
    parser.add_argument('--cpu', action='store_true', help='上报 CPU 使用率')
    parser.add_argument('--mem', action='store_true', help='上报内存使用率')
    parser.add_argument('--disk', action='store_true', help='上报磁盘使用率')
    parser.add_argument('--temp', action='store_true', help='上报 CPU 温度')
    parser.add_argument('--load', action='store_true', help='上报系统负载')
    parser.add_argument('--net', action='store_true', help='上报网络流量')
    parser.add_argument('--ip', action='store_true', help='上报内网 IPv4（192.168.0.0/16）')
    parser.add_argument('--uptime', action='store_true', help='上报运行时长')
    parser.add_argument('--all', action='store_true', help='上报全部指标')
    parser.add_argument('--extra', default=None, help='附加信息：任意字符串，作附件展示（只保留最新值）')
    parser.add_argument('--custom', default=None, help='约定 JSON 自定义指标：{"category":"系统","custom":[{"label":"电量","type":"percent","value":61,"unit":"%","warn":30,"crit":10,"summary":true}]}')
    parser.add_argument('--interval', type=int, default=0, help='定时上报间隔（秒），默认单次')

    args = parser.parse_args()

    if args.all:
        args.cpu = args.mem = args.disk = args.temp = args.load = args.net = args.ip = args.uptime = True

    hostname = args.hostname or socket.gethostname() or 'unknown'

    if args.interval > 0:
        print(f"开始定时上报，间隔 {args.interval}s，主机名: {hostname}")
        while True:
            payload = build_payload(hostname, args)
            if payload['data'] or 'extra' in payload or 'custom' in payload:
                report(args.url, args.token, payload)
            else:
                print("未开启任何上报项，跳过")
            time.sleep(args.interval)
    else:
        payload = build_payload(hostname, args)
        if not payload['data'] and 'extra' not in payload and 'custom' not in payload:
            print("未开启任何上报项，使用 --cpu --mem 等参数开启，或 --all")
            sys.exit(1)
        report(args.url, args.token, payload)


if __name__ == '__main__':
    main()
