#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取 Wikimedia Commons 上的湘潭大学照片，压成 webp，并写出 CREDITS.md

用法（在仓库根目录跑）：
    python enroll/tools/fetch_photos.py              # 缺什么抓什么
    python enroll/tools/fetch_photos.py --refresh     # 全部重新抓
    python enroll/tools/fetch_photos.py --list        # 只打印清单，不下载

照片全部来自 Commons 的 Category:Xiangtan University，作者 Huangdan2060，
CC BY 3.0 —— 可商用、可修改，但必须署名，所以脚本会顺手把 CREDITS.md 写好。

依赖：Pillow；抓图需要联网。跑完照片就在 enroll/assets/photos/ 里，
页面运行时不再联网。
"""

import argparse
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import PIL
    from PIL import Image
except ImportError:
    sys.exit('缺少 Pillow，请先安装：pip install pillow')

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent          # 即 enroll/
PHOTOS_DIR = ROOT / 'assets' / 'photos'
CREDITS = ROOT / 'CREDITS.md'

API = 'https://commons.wikimedia.org/w/api.php'
UA = ('nailong-museum-enroll/1.0 '
      '(https://github.com/immortal-water/iw_hu-nai-u; contact: tu_dou_xuan@qq.com)')

# 本地文件名 → Commons 上的原始文件名
PHOTOS = [
    ('school-gate', 'School gate, Xiangtan University, 7 April 2020b.jpg'),
    ('east-gate',   'East Entrance, Xiangtan University.jpg'),
    ('library',     'Library, Xiangtan University, 7 April 2020a.jpg'),
    ('statue',      'Statue of Mao Zedong, Xiangtan University3.jpg'),
    ('lake',        'Lake Qin, Xiangtan University1.jpg'),
    ('pond',        'Pond, Xiangtan University.jpg'),
    ('dorm',        'Dormitories, Xiangtan University, 7 April 2020a.jpg'),
    ('yifu',        'A panoramic view of Yifu Teaching Building, Xiangtan University.jpg'),
    ('gym',         'Gymnasium, Xiangtan University.jpg'),
    ('campus',      'Xiangtan University, 7 April 2020a.jpg'),
]

DOWNLOAD_WIDTH = 1800      # 先让 Commons 缩到这个宽度再下，省流量
TARGET_WIDTH = 1600        # 存进仓库的宽度
QUALITY = 80

TAG_RE = re.compile(r'<[^>]+>')


def log(msg=''):
    print(msg, flush=True)


def api_get(params):
    params = dict(params, format='json', formatversion='2')
    url = API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA,
                                               'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=40) as resp:
        return json.load(resp)


def strip_html(value):
    return html.unescape(TAG_RE.sub('', value or '')).strip()


def resolve():
    """一次问清所有图的原页地址、作者、授权"""
    titles = '|'.join('File:' + name for _, name in PHOTOS)
    data = api_get({'action': 'query', 'titles': titles, 'prop': 'imageinfo',
                    'iiprop': 'url|extmetadata', 'iiurlwidth': DOWNLOAD_WIDTH})
    out = {}
    for page in data.get('query', {}).get('pages', []):
        if 'missing' in page or not page.get('imageinfo'):
            out[page['title'][5:]] = None
            continue
        info = page['imageinfo'][0]
        meta = info.get('extmetadata', {})
        out[page['title'][5:]] = {
            'download': info.get('thumburl') or info['url'],
            'page': info['descriptionurl'],
            'author': strip_html(meta.get('Artist', {}).get('value')) or '未知',
            'license': meta.get('LicenseShortName', {}).get('value') or '未知',
            'license_url': meta.get('LicenseUrl', {}).get('value') or '',
        }
    return out


def fetch(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as resp:
        dest.write_bytes(resp.read())


def convert(src, dest):
    with Image.open(src) as im:
        im = im.convert('RGB')
        w, h = im.size
        if w > TARGET_WIDTH:
            im = im.resize((TARGET_WIDTH, max(1, round(h * TARGET_WIDTH / w))),
                           Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, 'WEBP', quality=QUALITY, method=5)
        return im.size


def write_credits(rows):
    lines = [
        '# 图片来源',
        '',
        '本页面的校园照片全部来自 [Wikimedia Commons]'
        '(https://commons.wikimedia.org/wiki/Category:Xiangtan_University)，',
        '作者 **Huangdan2060**，2020 年 4 月摄，授权 **CC BY 3.0**'
        '（[授权全文](https://creativecommons.org/licenses/by/3.0)）。',
        '',
        'CC BY 3.0 允许商用与修改，但**要求署名**。页面页脚已标注，本文件逐张列出原始出处。',
        '',
        '| 本地文件 | 原始文件 | 作者 | 授权 | 原始页面 |',
        '|---|---|---|---|---|',
    ]
    for local, original, meta in rows:
        lines.append('| `{}` | {} | {} | {} | [Commons]({}) |'.format(
            local, original.replace('|', '\\|'), meta['author'],
            meta['license'], meta['page']))
    lines += [
        '',
        '## 备注',
        '',
        '- `statue.webp`（毛泽东铜像）基座上的 1958 年题词在中国境内'
        '于 2027-01-01 才进入公有领域。照片本身为 CC BY 3.0（Commons 以'
        '「全景自由」并标注微量使用收录），页面中该题词只占画面很小一块，并非主体。',
        '- 湘大官网、各学院网站与微信公众号中的图片均有版权，本项目未使用。',
        '',
        '由 `enroll/tools/fetch_photos.py` 自动生成。',
        '',
    ]
    CREDITS.write_text('\n'.join(lines), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(description='抓取并压缩湘潭大学照片')
    ap.add_argument('--refresh', action='store_true', help='已存在的也重新抓')
    ap.add_argument('--list', action='store_true', help='只打印清单')
    args = ap.parse_args()

    if args.list:
        for local, name in PHOTOS:
            log(f'{local:12s} {name}')
        return

    log(f'Pillow {getattr(PIL, "__version__", "?")} · 输出目录 {PHOTOS_DIR}')
    log(f'\n[1/3] 解析 {len(PHOTOS)} 张图的原始信息')
    try:
        resolved = resolve()
    except Exception as exc:
        sys.exit(f'查询 Commons 失败：{exc}')

    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = PHOTOS_DIR / '.download.tmp'
    rows, failed = [], []

    log('\n[2/3] 下载并转 webp')
    for local, name in PHOTOS:
        dest = PHOTOS_DIR / f'{local}.webp'
        meta = resolved.get(name)
        if not meta:
            log(f'  [!] {local}: Commons 上没有这个文件（{name}）')
            failed.append(local)
            continue
        if dest.exists() and not args.refresh:
            with Image.open(dest) as im:
                log(f'  跳过 {local}.webp（已存在 {im.size[0]}×{im.size[1]}）')
            rows.append((f'{local}.webp', name, meta))
            continue
        try:
            fetch(meta['download'], tmp)
            size = convert(tmp, dest)
            kb = dest.stat().st_size / 1024
            log(f'  {local}.webp  {size[0]}×{size[1]}  {kb:.0f} KB')
            rows.append((f'{local}.webp', name, meta))
        except Exception as exc:
            log(f'  [!] {local}: {exc}')
            failed.append(local)

    tmp.unlink(missing_ok=True)

    log('\n[3/3] 写出 CREDITS.md')
    write_credits(rows)
    total = sum((PHOTOS_DIR / r[0]).stat().st_size for r in rows) / 1024
    log(f'  {len(rows)} 张 · 合计 {total:.0f} KB')
    if failed:
        log(f'  失败 {len(failed)} 张：{"、".join(failed)}')
    log('\n完成。')


if __name__ == '__main__':
    main()
