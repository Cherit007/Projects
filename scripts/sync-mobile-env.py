#!/usr/bin/env python3
"""Copy repo root VITE_* vars into apps/mobile/.env as EXPO_PUBLIC_*."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROOT_ENV = ROOT / '.env'
MOBILE_ENV = ROOT / 'apps' / 'mobile' / '.env'


def main() -> None:
    if not ROOT_ENV.exists():
        raise SystemExit(f'Missing {ROOT_ENV}')

    lines: list[str] = []
    for raw in ROOT_ENV.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        key = key.strip()
        if key.startswith('VITE_'):
            lines.append(f'EXPO_PUBLIC_{key[len("VITE_"):]}={value}')

    if not lines:
        raise SystemExit('No VITE_* entries found in root .env')

    header = (
        '# Synced from repo root .env — restart Expo after changes.\n'
        '# Regenerate: python3 scripts/sync-mobile-env.py\n\n'
    )
    MOBILE_ENV.write_text(header + '\n'.join(lines) + '\n')
    print(f'Wrote {len(lines)} EXPO_PUBLIC_* vars to {MOBILE_ENV}')


if __name__ == '__main__':
    main()
