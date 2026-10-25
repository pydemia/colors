#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || {
    echo "This runtime is pinned for Linux x86_64." >&2
    exit 1
}

config_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
service_root="${HOME}/workspaces/colors"
runtime_dir="${HOME}/.local/share/colors/runtime/caddy-2.11.7"
cache_dir="${HOME}/.cache/colors"
archive="${cache_dir}/caddy_2.11.7_linux_amd64.tar.gz"
checksum="a7a433a1b133efc3c8d10eb0b99d52a24b5ef5c322dc77f5282182b1c0402139ab83f3a99f0c52409df77d20123fb0b523edad8a66d8f5e49136197bf61ef0e7"

mkdir -p "${runtime_dir}" "${cache_dir}" "${service_root}/releases" \
    "${service_root}/shared/assets" "${HOME}/.config/systemd/user"
if [[ ! -f "${archive}" ]]; then
    curl --fail --location --silent --show-error --proto '=https' \
        'https://github.com/caddyserver/caddy/releases/download/v2.11.7/caddy_2.11.7_linux_amd64.tar.gz' \
        --output "${archive}.download"
    printf '%s  %s\n' "${checksum}" "${archive}.download" | sha512sum --check
    mv -- "${archive}.download" "${archive}"
fi
printf '%s  %s\n' "${checksum}" "${archive}" | sha512sum --check
tar -xOf "${archive}" caddy > "${runtime_dir}/caddy.new"
chmod 755 "${runtime_dir}/caddy.new"
mv -f -- "${runtime_dir}/caddy.new" "${runtime_dir}/caddy"

COLORS_SITE_ROOT="${service_root}/current" \
COLORS_ASSET_ROOT="${service_root}/shared" \
    "${runtime_dir}/caddy" validate --adapter caddyfile \
    --config "${config_dir}/Caddyfile"
install -m 644 "${config_dir}/Caddyfile" "${service_root}/Caddyfile"
install -m 644 "${config_dir}/colors.service" \
    "${HOME}/.config/systemd/user/colors.service"
loginctl --no-ask-password enable-linger "$(id -un)"
systemctl --user daemon-reload
systemctl --user enable colors.service
"${runtime_dir}/caddy" version
